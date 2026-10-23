import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { GET as listOrders, POST as createOrder } from "../src/app/api/orders/route";
import { POST as confirmOrder } from "../src/app/api/orders/[orderId]/confirm/route";
import { PATCH as updateOrder } from "../src/app/api/staff/orders/[orderId]/route";
import { parseStaffOrderUpdate, validCreateOrderInput } from "../src/lib/orders";

const customer = { id: "22222222-2222-4222-8222-222222222222", role: "customer", status: "active" };
const otherCustomer = { id: "55555555-5555-4555-8555-555555555555", role: "customer", status: "active" };
const staff = { id: "33333333-3333-4333-8333-333333333333", role: "staff", status: "active" };
const otherStaff = { id: "44444444-4444-4444-8444-444444444444", role: "staff", status: "active" };
const storeA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const productId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const requestId = "66666666-6666-4666-8666-666666666666";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const tokens = new Map<string, Record<string, string>>([[hash("customer"), customer], [hash("other-customer"), otherCustomer], [hash("staff"), staff], [hash("other-staff"), otherStaff]]);

function request(path: string, token: string, method = "GET", body?: unknown) {
  return new Request(`http://localhost:3000${path}`, { method,
    headers: { cookie: `tonphueng_session=${token}`, ...(method === "GET" ? {} : { origin: "http://localhost:3000", "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const params = (orderId: string) => ({ params: Promise.resolve({ orderId }) });
const rpcError = (code: string, message: string) => Response.json({ code, message }, { status: 400 });

/** HTTP double of PostgREST + migration 008 RPC semantics (server-side cart pricing, idempotency, ownership). */
function installFake(fulfillment: "pickup" | "delivery" = "delivery") {
  vi.stubEnv("SUPABASE_URL", "http://supabase.test"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key"); vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  let cart: { service_id: string; quantity: number; fulfillment: string; address: string } | null = { service_id: storeA, quantity: 2, fulfillment, address: fulfillment === "delivery" ? "บ้านเลขที่ 12" : "" };
  const orders = new Map<string, Record<string, unknown>>();
  const owners = new Map<string, { customer: string; request: string }>();
  const rpcCalls: Array<{ name: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {};
    if (url.pathname === "/rest/v1/app_sessions") {
      const account = tokens.get(url.searchParams.get("token_hash")?.slice(3) ?? "");
      return Response.json(account ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: account } : null);
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = url.pathname.split("/").at(-1)!;
      rpcCalls.push({ name, body });
      if (name === "create_product_order") {
        const existing = [...owners].find(([, owner]) => owner.customer === body.target_customer_id && owner.request === body.target_request_id);
        if (existing) return Response.json(orders.get(existing[0]));
        if (!cart) return rpcError("P0002", "cart empty");
        if (cart.service_id !== body.target_expected_service_id) return rpcError("40001", "cart changed");
        const id = "99999999-9999-4999-8999-99999999999" + orders.size;
        const shipping = cart.fulfillment === "delivery" ? 5000 : 0;
        const order = { id, service_id: storeA, store_name: "ร้านต้นผึ้ง", fulfillment: cart.fulfillment, delivery_address: cart.address,
          subtotal_satang: 12550 * cart.quantity, shipping_satang: shipping, total_satang: 12550 * cart.quantity + shipping, payment_method: "simulated_demo",
          payment_status: "pending_simulated", status: "pending_payment", tracking_number: null, created_at: "2026-10-23T00:00:00Z", paid_at: null,
          status_updated_at: "2026-10-23T00:00:00Z", items: [{ product_id: productId, product_name: "น้ำผึ้ง", unit_price_satang: 12550, quantity: cart.quantity, line_total_satang: 12550 * cart.quantity }] };
        orders.set(id, order); owners.set(id, { customer: String(body.target_customer_id), request: String(body.target_request_id) }); cart = null;
        return Response.json(order);
      }
      if (name === "confirm_product_order") {
        const order = orders.get(String(body.target_order_id));
        if (!order || owners.get(String(order.id))?.customer !== body.target_customer_id) return rpcError("P0002", "order not found");
        if (order.payment_status === "pending_simulated") Object.assign(order, { payment_status: "paid_simulated", status: "paid", paid_at: new Date().toISOString() });
        return Response.json(order);
      }
      if (name === "update_staff_product_order") {
        const order = orders.get(String(body.target_order_id));
        if (!order || body.target_staff_id !== staff.id || order.payment_status !== "paid_simulated") return rpcError("42501", "order not found");
        if (order.fulfillment === "pickup" && body.target_tracking_number) return rpcError("22023", "tracking number not allowed for pickup");
        Object.assign(order, { status: body.target_status, tracking_number: body.target_tracking_number });
        return Response.json(order);
      }
    }
    if (url.pathname === "/rest/v1/product_orders" && (init?.method ?? "GET") === "GET") {
      const owner = url.searchParams.get("customer_account_id")?.slice(3);
      return Response.json([...orders.values()].filter((order) => owners.get(String(order.id))?.customer === owner));
    }
    throw new Error(`Unexpected fake Supabase request ${init?.method ?? "GET"} ${url.pathname}`);
  }));
  return { rpcCalls, orders };
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Product Order boundaries", () => {
  it("accepts only a request UUID and reviewed store; normalizes Staff tracking input", () => {
    const input = { request_id: requestId, expected_service_id: storeA };
    expect(validCreateOrderInput(input)).toBe(true);
    for (const tampered of [{ total_satang: 1 }, { shipping_satang: 0 }, { customer_account_id: otherCustomer.id }, { items: [{ product_id: productId, quantity: 1, price_satang: 1 }] }])
      expect(validCreateOrderInput({ ...input, ...tampered })).toBe(false);
    expect(validCreateOrderInput({ ...input, request_id: "not-a-uuid" })).toBe(false);
    expect(parseStaffOrderUpdate({ status: "shipping", tracking_number: "  TH123  " })).toEqual({ status: "shipping", tracking_number: "TH123" });
    expect(parseStaffOrderUpdate({ status: "preparing", tracking_number: "" })).toEqual({ status: "preparing", tracking_number: null });
    expect(parseStaffOrderUpdate({ status: "paid", tracking_number: "" })).toBeNull();
    expect(parseStaffOrderUpdate({ status: "delivered", tracking_number: "<script>" })).toBeNull();
    expect(parseStaffOrderUpdate({ status: "delivered", tracking_number: "", service_id: storeA })).toBeNull();
  });

  it("creates one Order from the session Customer's cart, ignores browser amounts, and replays duplicates", async () => {
    const { rpcCalls, orders } = installFake();
    const tampered = await createOrder(request("/api/orders", "customer", "POST", { request_id: requestId, expected_service_id: storeA, total_satang: 1, shipping_satang: 0 }));
    expect(tampered.status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
    const first = await createOrder(request("/api/orders", "customer", "POST", { request_id: requestId, expected_service_id: storeA }));
    const replay = await createOrder(request("/api/orders", "customer", "POST", { request_id: requestId, expected_service_id: storeA }));
    expect(first.status).toBe(201); expect(replay.status).toBe(201);
    const order = (await first.json()).order;
    expect(order).toMatchObject({ subtotal_satang: 25100, shipping_satang: 5000, total_satang: 30100, payment_status: "pending_simulated" });
    expect((await replay.json()).order.id).toBe(order.id);
    expect(orders.size).toBe(1);
    expect(rpcCalls[0].body).toEqual({ target_customer_id: customer.id, target_request_id: requestId, target_expected_service_id: storeA });
    const second = await createOrder(request("/api/orders", "customer", "POST", { request_id: "77777777-7777-4777-8777-777777777777", expected_service_id: storeA }));
    expect(second.status).toBe(409);
    expect((await second.json()).code).toBe("cart_empty");
    expect((await createOrder(request("/api/orders", "staff", "POST", { request_id: requestId, expected_service_id: storeA }))).status).toBe(403);
  });

  it("confirms the simulated payment once for its owner and denies other accounts", async () => {
    installFake();
    const order = (await (await createOrder(request("/api/orders", "customer", "POST", { request_id: requestId, expected_service_id: storeA }))).json()).order;
    const path = `/api/orders/${order.id}/confirm`;
    expect((await confirmOrder(request(path, "other-customer", "POST", {}), params(order.id))).status).toBe(404);
    expect((await confirmOrder(request(path, "staff", "POST", {}), params(order.id))).status).toBe(403);
    const first = await (await confirmOrder(request(path, "customer", "POST", {}), params(order.id))).json();
    const again = await (await confirmOrder(request(path, "customer", "POST", {}), params(order.id))).json();
    expect(first.order).toMatchObject({ payment_status: "paid_simulated", status: "paid" });
    expect(again.order.paid_at).toBe(first.order.paid_at);
    expect((await (await listOrders(request("/api/orders", "other-customer"))).json()).orders).toEqual([]);
    expect((await (await listOrders(request("/api/orders", "customer"))).json()).orders).toHaveLength(1);
  });

  it("lets only the owning Staff update a paid Order and keeps pickup free of tracking numbers", async () => {
    installFake("pickup");
    const order = (await (await createOrder(request("/api/orders", "customer", "POST", { request_id: requestId, expected_service_id: storeA }))).json()).order;
    const path = `/api/staff/orders/${order.id}`;
    expect((await updateOrder(request(path, "staff", "PATCH", { status: "preparing", tracking_number: "" }), params(order.id))).status).toBe(404);
    await confirmOrder(request(`/api/orders/${order.id}/confirm`, "customer", "POST", {}), params(order.id));
    expect((await updateOrder(request(path, "other-staff", "PATCH", { status: "preparing", tracking_number: "" }), params(order.id))).status).toBe(404);
    expect((await updateOrder(request(path, "customer", "PATCH", { status: "preparing", tracking_number: "" }), params(order.id))).status).toBe(403);
    expect((await updateOrder(request(path, "staff", "PATCH", { status: "paid", tracking_number: "" }), params(order.id))).status).toBe(400);
    const tracked = await updateOrder(request(path, "staff", "PATCH", { status: "delivered", tracking_number: "TH1" }), params(order.id));
    expect(tracked.status).toBe(400);
    expect((await tracked.json()).error).toMatch(/รับที่ร้าน/);
    const done = await updateOrder(request(path, "staff", "PATCH", { status: "delivered", tracking_number: "" }), params(order.id));
    expect(done.status).toBe(200);
    expect((await done.json()).order).toMatchObject({ status: "delivered", tracking_number: null });
  });
});
