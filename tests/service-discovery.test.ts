import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { GET as list, OPTIONS as servicesOptions } from "../src/app/api/services/route";
import { DELETE, GET as myTrip, POST as save } from "../src/app/api/my-trip/route";
import { getActiveService } from "../src/lib/services";

const customerA = { id: "11111111-1111-4111-8111-111111111111", role: "customer", status: "active", line_subject: "U_a", auth_user_id: null };
const customerB = { id: "22222222-2222-4222-8222-222222222222", role: "customer", status: "active", line_subject: "U_b", auth_user_id: null };
const serviceA = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", account_id: "33333333-3333-4333-8333-333333333333", name: "ใกล้", description: "รายละเอียดเต็ม", address: "บ้านต้นผึ้ง", latitude: 18.8, longitude: 98.9, phone: "0800000000", category: "community_product", other_category: null, photo_paths: ["private-account/photo.webp"] };
const serviceB = { ...serviceA, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", account_id: "44444444-4444-4444-8444-444444444444", name: "ไกล", latitude: 19.8, longitude: 99.9, photo_paths: [] };
const pendingService = { ...serviceA, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", account_id: "55555555-5555-4555-8555-555555555555", name: "รออนุมัติ" };
const activeIds = [serviceA.account_id, serviceB.account_id];
const saved = new Map<string, Set<string>>();

function req(path: string, token?: string, method = "GET", body?: unknown, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { ...(token ? { cookie: `tonphueng_session=${token}` } : {}), ...(method !== "GET" ? { origin, "content-type": "application/json" } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function installBoundary(services = [serviceA, serviceB]) {
  vi.stubEnv("SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  saved.clear();
  const requests: { url: URL; method: string; body: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : "";
    requests.push({ url, method, body });
    const account = new Map([[createHash("sha256").update("customer-a").digest("hex"), customerA], [createHash("sha256").update("customer-b").digest("hex"), customerB]]);
    if (url.pathname === "/rest/v1/app_sessions") {
      const row = account.get(url.searchParams.get("token_hash")?.slice(3) ?? "");
      return Response.json(row ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: row } : null);
    }
    if (url.pathname === "/rest/v1/app_accounts" && method === "GET") {
      if (url.searchParams.get("id")?.startsWith("eq.")) {
        const id = url.searchParams.get("id")!.slice(3);
        return Response.json(activeIds.includes(id) ? { id } : null);
      }
      return Response.json(activeIds.map((id) => ({ id })));
    }
    if (url.pathname === "/rest/v1/services" && method === "GET") {
      const idFilter = url.searchParams.get("id") ?? "";
      if (idFilter.startsWith("eq.")) return Response.json([...services, pendingService].find((service) => service.id === idFilter.slice(3) && activeIds.includes(service.account_id)) ?? null);
      if (idFilter.startsWith("in.")) {
        const ids = idFilter.slice(4, -1).split(",");
        return Response.json([...services, pendingService].filter((service) => ids.includes(service.id) && activeIds.includes(service.account_id)));
      }
      const category = url.searchParams.get("category")?.slice(3);
      const allowed = services.filter((service) => activeIds.includes(service.account_id) && (!category || service.category === category));
      return Response.json(allowed);
    }
    if (url.pathname === "/storage/v1/object/sign/staff-business-photos" && method === "POST") {
      const paths = (JSON.parse(body) as { paths: string[] }).paths;
      return Response.json(paths.map((path) => ({ path, signedURL: `/signed/${path}?token=test` })));
    }
    if (url.pathname === "/rest/v1/my_trip_saved_services" && method === "GET") {
      const owner = url.searchParams.get("customer_account_id")?.slice(3) ?? "";
      return Response.json([...(saved.get(owner) ?? [])].map((service_id) => ({ service_id, created_at: "2026-10-23T00:00:00.000Z" })));
    }
    if (url.pathname === "/rest/v1/my_trip_saved_services" && method === "POST") {
      const input = JSON.parse(body) as { customer_account_id: string; service_id: string };
      const rows = saved.get(input.customer_account_id) ?? new Set<string>();
      rows.add(input.service_id); saved.set(input.customer_account_id, rows);
      return new Response(null, { status: 201 });
    }
    if (url.pathname === "/rest/v1/my_trip_saved_services" && method === "DELETE") {
      const owner = url.searchParams.get("customer_account_id")?.slice(3) ?? "";
      const serviceId = url.searchParams.get("service_id")?.slice(3) ?? "";
      saved.get(owner)?.delete(serviceId);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected test boundary request: ${method} ${url.pathname}`);
  }));
  return requests;
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); saved.clear(); });

describe("service discovery and My Trip HTTP boundary", () => {
  it("requires a valid category and emits only active Staff public fields", async () => {
    const requests = installBoundary();
    expect((await list(req("/api/services?category=all"))).status).toBe(400);
    expect(requests).toHaveLength(0);
    const all = await list(req("/api/services"));
    expect(all.status).toBe(200);
    expect(all.headers.get("access-control-allow-origin")).toBe("*");
    expect((await all.json()).services).toHaveLength(2);
    const response = await list(req("/api/services?category=community_product"));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.services.map((service: { name: string }) => service.name)).toEqual(["ใกล้", "ไกล"]);
    expect(result.services[0]).toMatchObject({ description: "รายละเอียดเต็ม", photos: [expect.stringContaining("/signed/")] });
    expect(JSON.stringify(result)).not.toMatch(/account_id|auth_user_id|photo_paths|รออนุมัติ/);
    expect(await getActiveService(pendingService.id)).toBeNull();
    expect(requests.some(({ url }) => url.pathname === "/rest/v1/app_accounts" && url.searchParams.get("status") === "eq.active")).toBe(true);
  });

  it("allows cross-origin reads and preflight only on the public Service endpoint", async () => {
    installBoundary();
    const preflight = await servicesOptions();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
    expect(preflight.headers.get("access-control-allow-methods")).toContain("GET");
    const invalid = await list(req("/api/services?category=all"));
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("access-control-allow-origin")).toBe("*");
    const trip = await myTrip(req("/api/my-trip", "customer-a"));
    expect(trip.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("keeps public Service failures readable to cross-origin callers", async () => {
    installBoundary();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "upstream unavailable" }, { status: 400 })));
    const response = await list(req("/api/services"));
    expect(response.status).toBe(503);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("uses true coordinate ordering and rejects partial or invalid coordinates", async () => {
    installBoundary();
    const ordered = await list(req("/api/services?category=community_product&latitude=18.8&longitude=98.9"));
    expect((await ordered.json()).services.map((service: { name: string }) => service.name)).toEqual(["ใกล้", "ไกล"]);
    expect((await list(req("/api/services?category=community_product&latitude=91&longitude=98"))).status).toBe(400);
    expect((await list(req("/api/services?category=community_product&latitude=18.8"))).status).toBe(400);
  });

  it("keeps GPS distance order global across offset pages", async () => {
    const rows = Array.from({ length: 13 }, (_, index) => ({
      ...serviceA,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      name: `ร้าน ${index}`,
      latitude: 18.8 + (12 - index) / 100,
      photo_paths: [],
    }));
    installBoundary(rows);
    const first = await (await list(req("/api/services?latitude=18.8&longitude=98.9"))).json();
    const second = await (await list(req("/api/services?offset=12&latitude=18.8&longitude=98.9"))).json();
    expect(first.services).toHaveLength(12);
    expect(first.services[0].name).toBe("ร้าน 12");
    expect(first.hasMore).toBe(true);
    expect(second.services.map((service: { name: string }) => service.name)).toEqual(["ร้าน 0"]);
    expect(second.hasMore).toBe(false);
  });

  it("persists saves for one active Customer, denies pending services and cross-origin writes", async () => {
    const requests = installBoundary();
    const csrf = await save(req("/api/my-trip", "customer-a", "POST", { service_id: serviceA.id }, "http://attacker.test"));
    expect(csrf.status).toBe(403);
    expect((await save(req("/api/my-trip", "customer-a", "POST", { service_id: pendingService.id }))).status).toBe(404);
    expect((await save(req("/api/my-trip", "", "POST", { service_id: serviceA.id }))).status).toBe(403);
    expect((await save(req("/api/my-trip", "customer-a", "POST", { service_id: serviceA.id }))).status).toBe(200);
    const a = await (await myTrip(req("/api/my-trip", "customer-a"))).json();
    const b = await (await myTrip(req("/api/my-trip", "customer-b"))).json();
    expect(a.services).toHaveLength(1);
    expect(a.services[0]).toMatchObject({ name: "ใกล้", saved_at: "2026-10-23T00:00:00.000Z" });
    expect(JSON.stringify(a)).not.toMatch(/account_id|auth_user_id|photo_paths/);
    expect(b.services).toEqual([]);
    expect((await DELETE(req("/api/my-trip", "customer-a", "DELETE", { service_id: serviceA.id }))).status).toBe(200);
    expect((await (await myTrip(req("/api/my-trip", "customer-a"))).json()).services).toEqual([]);
    const write = requests.find(({ method, url }) => method === "POST" && url.pathname === "/rest/v1/my_trip_saved_services");
    expect(write?.url.searchParams.get("on_conflict")).toBe("customer_account_id,service_id");
    expect(JSON.parse(write!.body).customer_account_id).toBe(customerA.id);
  });
});
