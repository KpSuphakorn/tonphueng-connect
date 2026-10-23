import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { GET as adminGet, POST as adminSave } from "../src/app/api/admin/packages/route";
import { GET as packageList } from "../src/app/api/packages/route";
import { GET as selectionGet, POST as selectionSave } from "../src/app/api/packages/selection/route";

const admin = { id: "11111111-1111-4111-8111-111111111111", role: "admin", status: "active" };
const customer = { id: "22222222-2222-4222-8222-222222222222", role: "customer", status: "active" };
const staff = { id: "33333333-3333-4333-8333-333333333333", role: "staff", status: "active" };
const pendingStaff = { id: "44444444-4444-4444-8444-444444444444", role: "staff", status: "pending" };
const serviceA = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", account_id: staff.id, name: "เส้นทางตัวอย่าง", category: "tourism_trail" };
const serviceB = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", account_id: pendingStaff.id, name: "เส้นทางรออนุมัติ", category: "tourism_trail" };
const serviceRestaurant = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", account_id: staff.id, name: "ร้านตัวอย่าง", category: "restaurant" };
const subId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const slotId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const initialCatalog = {
  title: "Trail & Running", description: "ข้อมูลตัวอย่าง", contact_url: "https://example.test/contact",
  sub_packages: [{ id: subId, title: "เดินป่าตัวอย่าง", description: "", price_per_person_satang: 125050,
    slots: [{ id: slotId, name: "เส้นทาง", service_category: "tourism_trail", required_count: 1, service_ids: [serviceA.id] }] }],
};
const catalog = new Map<string, { catalog: typeof initialCatalog; revision: number }>();
const saved = new Map<string, Record<string, unknown>>();
const accounts = [admin, customer, staff, pendingStaff];

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
function req(path: string, token = "", method = "GET", body?: unknown, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { ...(token ? { cookie: `tonphueng_session=${token}` } : {}), ...(method !== "GET" ? { origin, "content-type": "application/json" } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function installBoundary() {
  vi.stubEnv("SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  catalog.clear(); saved.clear();
  catalog.set("trail_running", { catalog: structuredClone(initialCatalog), revision: 1 });
  const requests: Array<{ url: URL; method: string; body: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : "";
    requests.push({ url, method, body });
    if (url.pathname === "/rest/v1/app_sessions") {
      const tokenHash = url.searchParams.get("token_hash")?.slice(3);
      const account = tokenHash === hash("admin-session") ? admin : tokenHash === hash("customer-session") ? customer : null;
      return Response.json(account ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: account } : null);
    }
    if (url.pathname === "/rest/v1/package_catalogs" && method === "GET") {
      const category = url.searchParams.get("category")?.slice(3);
      const rows = [...catalog.entries()].map(([key, value]) => ({ category: key, catalog: value.catalog, revision: value.revision }));
      return Response.json(category ? rows.find((row) => row.category === category) ?? null : rows);
    }
    if (url.pathname === "/rest/v1/services" && method === "GET") {
      const filter = url.searchParams.get("id") ?? "";
      const ids = filter.startsWith("in.") ? filter.slice(4, -1).split(",") : [];
      return Response.json([serviceA, serviceB, serviceRestaurant].filter((service) => !ids.length || ids.includes(service.id)));
    }
    if (url.pathname === "/rest/v1/app_accounts" && method === "GET") {
      const filter = url.searchParams.get("id") ?? "";
      const ids = filter.startsWith("in.") ? filter.slice(4, -1).split(",") : [];
      const role = url.searchParams.get("role")?.slice(3);
      const status = url.searchParams.get("status")?.slice(3);
      return Response.json(accounts.filter((account) => (!ids.length || ids.includes(account.id)) && (!role || account.role === role) && (!status || account.status === status)).map(({ id }) => ({ id })));
    }
    if (url.pathname === "/rest/v1/package_customer_selections" && method === "GET") {
      const owner = url.searchParams.get("customer_account_id")?.slice(3);
      return Response.json([...saved.values()].filter((row) => row.customer_account_id === owner));
    }
    if (url.pathname === "/rest/v1/rpc/save_package_catalog" && method === "POST") {
      const input = JSON.parse(body) as { target_category: string; target_expected_revision: number; target_catalog: typeof initialCatalog };
      const revision = (catalog.get(input.target_category)?.revision ?? 0) + 1;
      catalog.set(input.target_category, { catalog: input.target_catalog, revision });
      return Response.json(revision);
    }
    if (url.pathname === "/rest/v1/rpc/save_package_selection" && method === "POST") {
      const input = JSON.parse(body) as { target_customer_id: string; target_category: string; target_sub_package_id: string; target_revision: number; target_choices: Array<{ slot_id: string; service_ids: string[] }> };
      const current = catalog.get(input.target_category);
      const sub = current?.catalog.sub_packages.find((item) => item.id === input.target_sub_package_id);
      if (!current || current.revision !== input.target_revision || !sub) return Response.json({ message: "stale" }, { status: 400 });
      const row = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", customer_account_id: input.target_customer_id, category: input.target_category, sub_package_id: input.target_sub_package_id, catalog_revision: current.revision, price_per_person_satang: sub.price_per_person_satang, choices: input.target_choices, updated_at: "2026-10-23T00:00:00.000Z" };
      saved.set(`${input.target_customer_id}:${input.target_sub_package_id}`, row);
      return Response.json([row]);
    }
    throw new Error(`Unexpected fake Supabase request ${method} ${url.pathname}`);
  }));
  return requests;
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); catalog.clear(); saved.clear(); });

describe("Package admin and Customer selection boundaries", () => {
  it("requires Admin to read or change catalogs and exposes only active public Services", async () => {
    installBoundary();
    expect((await adminGet(req("/api/admin/packages", "customer-session"))).status).toBe(403);
    expect((await adminSave(req("/api/admin/packages", "customer-session", "POST", { category: "trail_running", catalog: initialCatalog }))).status).toBe(403);
    const response = await packageList();
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.categories[0].sub_packages[0].price_per_person_satang).toBe(125050);
    expect(result.categories[0].sub_packages[0].slots[0].options).toEqual([{ id: serviceA.id, name: serviceA.name, category: serviceA.category }]);
    expect(JSON.stringify(result)).not.toMatch(/account_id|auth_user_id|photo_paths|เส้นทางรออนุมัติ/);
  });

  it("saves an Admin catalog revision and rejects a slot whose category or options do not match active Services", async () => {
    const requests = installBoundary();
    const adminRequest = (catalogValue: unknown) => adminSave(req("/api/admin/packages", "admin-session", "POST", { category: "trail_running", revision: catalog.get("trail_running")?.revision ?? 0, catalog: catalogValue }));
    const savedResponse = await adminRequest(initialCatalog);
    expect(savedResponse.status).toBe(200);
    expect((await savedResponse.json()).revision).toBe(2);
    const mismatch = { ...initialCatalog, sub_packages: [{ ...initialCatalog.sub_packages[0], slots: [{ ...initialCatalog.sub_packages[0].slots[0], service_category: "restaurant" }] }] };
    expect((await adminRequest(mismatch)).status).toBe(400);
    const pending = { ...initialCatalog, sub_packages: [{ ...initialCatalog.sub_packages[0], slots: [{ ...initialCatalog.sub_packages[0].slots[0], service_ids: [serviceB.id] }] }] };
    expect((await adminRequest(pending)).status).toBe(400);
    const write = requests.find((item) => item.url.pathname.endsWith("/rpc/save_package_catalog"));
    expect(JSON.parse(write!.body).target_catalog.sub_packages[0].price_per_person_satang).toBe(125050);
  });

  it("persists exact choices with server price and rejects forged price, wrong count, and wrong service", async () => {
    const requests = installBoundary();
    const valid = { category: "trail_running", sub_package_id: subId, revision: 1, choices: [{ slot_id: slotId, service_ids: [serviceA.id] }] };
    expect((await selectionSave(req("/api/packages/selection", "", "POST", valid))).status).toBe(403);
    expect((await selectionSave(req("/api/packages/selection", "customer-session", "POST", { ...valid, price_per_person_satang: 1 }))).status).toBe(400);
    expect((await selectionSave(req("/api/packages/selection", "customer-session", "POST", { ...valid, choices: [] }))).status).toBe(400);
    expect((await selectionSave(req("/api/packages/selection", "customer-session", "POST", { ...valid, choices: [{ slot_id: slotId, service_ids: [serviceRestaurant.id] }] }))).status).toBe(400);
    const response = await selectionSave(req("/api/packages/selection", "customer-session", "POST", valid));
    expect(response.status).toBe(200);
    expect((await response.json()).selection.price_per_person_satang).toBe(125050);
    const savedRow = await selectionGet(req("/api/packages/selection", "customer-session"));
    expect((await savedRow.json()).selections[0]).toMatchObject({ sub_package_id: subId, choices: valid.choices, price_per_person_satang: 125050 });
    expect(requests.some((item) => item.url.pathname.endsWith("/rpc/save_package_selection"))).toBe(true);
  });
});
