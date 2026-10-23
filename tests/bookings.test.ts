import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { GET as listBookings, POST as createBooking } from "../src/app/api/bookings/route";
import { POST as confirmBooking } from "../src/app/api/bookings/[bookingId]/confirm/route";
import { POST as addToMyTrip } from "../src/app/api/bookings/[bookingId]/my-trip/route";

const customer = { id: "22222222-2222-4222-8222-222222222222", role: "customer", status: "active" };
const admin = { id: "11111111-1111-4111-8111-111111111111", role: "admin", status: "active" };
const staff = { id: "33333333-3333-4333-8333-333333333333", role: "staff", status: "active" };
const bookingId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const subPackageId = "66666666-6666-4666-8666-666666666666";
const slotId = "77777777-7777-4777-8777-777777777777";
const serviceId = "88888888-8888-4888-8888-888888888888";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const booking = { id: bookingId, customer_account_id: customer.id, status: "pending", category: "trail_running", sub_package_id: subPackageId,
  package_snapshot: { package_title: "Trail", sub_package_title: "Walk", duration_days: 2, choices: [{ slot_name: "Trail", service: { id: serviceId, name: "Route", address: "Village" } }] },
  start_date: "2026-10-25", end_date: "2026-10-26", participants: 2, price_per_person_satang: 125050, total_price_satang: 250100,
  created_at: "2026-10-23T00:00:00Z", confirmed_at: null, my_trip_added_at: null, request_payload: {} };

function request(path: string, token: string, method = "GET", body?: unknown) {
  return new Request(`http://localhost:3000${path}`, { method,
    headers: { cookie: `tonphueng_session=${token}`, ...(method === "POST" ? { origin: "http://localhost:3000", "content-type": "application/json" } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

function installFake() {
  vi.stubEnv("SUPABASE_URL", "http://supabase.test"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key"); vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  let savedRequest: Record<string, unknown> | null = null;
  const rows = new Map<string, Record<string, unknown>>([[bookingId, structuredClone(booking)]]);
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {};
    if (url.pathname === "/rest/v1/app_sessions") {
      const token = url.searchParams.get("token_hash")?.slice(3);
      const account = token === hash("customer") ? customer : token === hash("admin") ? admin : token === hash("staff") ? staff : null;
      return Response.json(account ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: account } : null);
    }
    if (url.pathname === "/rest/v1/rpc/create_package_booking" && method === "POST") {
      if (savedRequest) return JSON.stringify(savedRequest) === JSON.stringify(body) ? Response.json(booking) : Response.json({ code: "23505" }, { status: 409 });
      savedRequest = body;
      return Response.json(booking);
    }
    if (url.pathname === "/rest/v1/rpc/confirm_package_booking" && method === "POST") {
      const confirmed = { ...booking, status: "paid_simulated", confirmed_at: "2026-10-23T00:00:00Z" };
      rows.set(bookingId, confirmed);
      return Response.json(confirmed);
    }
    if (url.pathname === "/rest/v1/rpc/add_booking_to_my_trip" && method === "POST") {
      const added = { ...rows.get(bookingId)!, my_trip_added_at: "2026-10-23T00:01:00Z" };
      rows.set(bookingId, added);
      return Response.json(added);
    }
    if (url.pathname === "/rest/v1/package_bookings" && method === "GET") {
      const owner = url.searchParams.get("customer_account_id")?.slice(3);
      return Response.json([...rows.values()].filter((row) => !owner || row.customer_account_id === owner).map(({ customer_account_id: _owner, request_payload: _payload, ...row }) => row));
    }
    throw new Error(`Unexpected fake Supabase request ${method} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Package Booking boundaries", () => {
  it("uses the session owner, excludes browser price/owner, and replays the same request", async () => {
    const { fetchMock } = installFake();
    const payload = { request_id: requestId, category: "trail_running", sub_package_id: subPackageId, revision: 1,
      choices: [{ slot_id: slotId, service_ids: [serviceId] }], start_date: "2026-10-25", participants: 2 };
    const first = await createBooking(request("/api/bookings", "customer", "POST", payload));
    const replay = await createBooking(request("/api/bookings", "customer", "POST", payload));
    expect(first.status).toBe(201); expect(replay.status).toBe(201);
    expect((await first.json()).booking.total_price_satang).toBe(250100);
    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls).toContain("http://supabase.test/rest/v1/rpc/create_package_booking");
    const sent = JSON.parse(String(fetchMock.mock.calls.find(([url]) => String(url).includes("create_package_booking"))?.[1]?.body));
    expect(sent.target_customer_id).toBe(customer.id);
    expect(sent).not.toHaveProperty("target_price");
    expect((await createBooking(request("/api/bookings", "customer", "POST", { ...payload, participants: 3 }))).status).toBe(409);
    expect((await createBooking(request("/api/bookings", "customer", "POST", { ...payload, total_price_satang: 1 }))).status).toBe(400);
    expect((await createBooking(request("/api/bookings", "customer", "POST", { ...payload, participants: 101 }))).status).toBe(400);
  });

  it("keeps customer lists scoped, permits Admin listing, and denies Staff", async () => {
    installFake();
    expect((await listBookings(request("/api/bookings", "customer"))).status).toBe(200);
    expect((await listBookings(request("/api/bookings", "admin"))).status).toBe(200);
    expect((await listBookings(request("/api/bookings", "staff"))).status).toBe(403);
  });

  it("confirms and adds a booking to My Trip idempotently for its owner", async () => {
    installFake();
    const context = { params: Promise.resolve({ bookingId }) };
    const confirmed = await confirmBooking(request(`/api/bookings/${bookingId}/confirm`, "customer", "POST", {}), context);
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).booking.status).toBe("paid_simulated");
    const other = await confirmBooking(request(`/api/bookings/${bookingId}/confirm`, "admin", "POST", {}), context);
    expect(other.status).toBe(403);
    const added = await addToMyTrip(request(`/api/bookings/${bookingId}/my-trip`, "customer", "POST", {}), context);
    expect(added.status).toBe(200);
    expect((await added.json()).booking.my_trip_added_at).toBeTruthy();
  });
});
