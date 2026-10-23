import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { POST as saveCart, GET as readCart } from "../src/app/api/cart/route";
import { parseProductPriceBaht } from "../src/lib/products";
import { validCartInput } from "../src/lib/cart";

const customer = { id: "22222222-2222-4222-8222-222222222222", role: "customer", status: "active", line_subject: "U_customer", auth_user_id: null };
const storeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const productId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hash = createHash("sha256").update("customer-session").digest("hex");
const cart = { available: true, service_id: storeId, store_name: "ร้านตัวอย่าง", fulfillment: "delivery", address: "บ้านเลขที่ 1", items: [{ product_id: productId, name: "น้ำผึ้ง", price_satang: 12550, quantity: 2, line_total_satang: 25100 }], subtotal_satang: 25100, shipping_satang: 5000, total_satang: 30100 };

function request(body?: unknown, session = "customer-session") {
  return new Request("http://localhost:3000/api/cart", {
    method: body === undefined ? "GET" : "POST",
    headers: { origin: "http://localhost:3000", ...(body === undefined ? {} : { "content-type": "application/json" }), ...(session ? { cookie: `tonphueng_session=${session}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function installBoundary(rpc: (name: string, body: Record<string, unknown>) => Response) {
  vi.stubEnv("SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/rest/v1/app_sessions") return Response.json(url.searchParams.get("token_hash") === `eq.${hash}` ? { expires_at: "2999-01-01T00:00:00Z", app_accounts: customer } : null);
    const name = url.pathname.split("/").at(-1) ?? "";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    calls.push({ name, body });
    return rpc(name, body);
  }));
  return calls;
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Product and cart trust boundaries", () => {
  it("parses baht directly to integer satang while allowing valid empty drafts to be rejected at save", () => {
    expect(parseProductPriceBaht("12")).toBe(1200);
    expect(parseProductPriceBaht("12.5")).toBe(1250);
    expect(parseProductPriceBaht("12.05")).toBe(1205);
    expect(parseProductPriceBaht("")).toBeNull();
    expect(parseProductPriceBaht("0")).toBeNull();
    expect(parseProductPriceBaht("1.005")).toBeNull();
    expect(parseProductPriceBaht("1e3")).toBeNull();
  });

  it("accepts one-store quantity updates but rejects duplicates and browser price/shipping fields", () => {
    const input = { service_id: storeId, items: [{ product_id: productId, quantity: 2 }], fulfillment: "delivery", address: "บ้านเลขที่ 1" };
    expect(validCartInput(input)).toBe(true);
    expect(validCartInput({ ...input, shipping_satang: 0 })).toBe(false);
    expect(validCartInput({ ...input, items: [{ product_id: productId, quantity: 2, price_satang: 1 }] })).toBe(false);
    expect(validCartInput({ ...input, items: [input.items[0], input.items[0]] })).toBe(false);
    expect(validCartInput({ ...input, items: [{ product_id: productId, quantity: 100 }] })).toBe(false);
    expect(validCartInput({ ...input, fulfillment: "pickup", address: "บ้านเลขที่ 1" })).toBe(false);
  });

  it("sends only selected product IDs and quantities to the server and returns server totals after reload", async () => {
    const calls = installBoundary((name, body) => {
      if (name === "save_customer_cart") return Response.json(cart);
      if (name === "read_customer_cart") return Response.json(cart);
      return Response.json({ message: "not found" }, { status: 404 });
    });
    const write = await saveCart(request({ service_id: storeId, items: [{ product_id: productId, quantity: 2 }], fulfillment: "delivery", address: "บ้านเลขที่ 1" }));
    expect(write.status).toBe(200);
    expect((await write.json()).cart.total_satang).toBe(30100);
    expect(calls[0].body).toMatchObject({ target_customer_id: customer.id, target_service_id: storeId, target_items: [{ product_id: productId, quantity: 2 }], target_fulfillment: "delivery" });
    expect(JSON.stringify(calls[0].body)).not.toMatch(/price|shipping|total/i);
    const reload = await readCart(request());
    expect((await reload.json()).cart).toEqual(cart);
  });

  it("rejects mixed-store updates and never calls the database for tampered amounts or unauthenticated reads", async () => {
    const calls = installBoundary((name) => name === "save_customer_cart" ? Response.json({ message: "cart store mismatch", code: "P0001" }, { status: 400 }) : Response.json({ message: "unexpected" }, { status: 404 }));
    const mixed = await saveCart(request({ service_id: storeId, items: [{ product_id: productId, quantity: 1 }], fulfillment: "pickup", address: "", price_satang: 1 }));
    expect(mixed.status).toBe(400);
    expect(calls).toHaveLength(0);
    const valid = await saveCart(request({ service_id: storeId, items: [{ product_id: productId, quantity: 1 }], fulfillment: "pickup", address: "" }));
    const validBody = await valid.json();
    expect(valid.status).toBe(409);
    expect(validBody).toMatchObject({ code: "cart_store_mismatch" });
    const before = calls.length;
    const unauthorized = await readCart(request(undefined, ""));
    expect(unauthorized.status).toBe(403);
    expect(calls).toHaveLength(before);
  });
});
