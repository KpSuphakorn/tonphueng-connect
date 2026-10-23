import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const staffId = "33333333-3333-4333-8333-333333333333";
const otherStaffId = "44444444-4444-4444-8444-444444444444";
const customerId = "22222222-2222-4222-8222-222222222222";
const otherCustomerId = "55555555-5555-4555-8555-555555555555";
const storeA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const storeB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const productA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const accounts = {
  "staff-session": { id: staffId, role: "staff", status: "active", line_subject: null, auth_user_id: "auth-staff" },
  "other-staff-session": { id: otherStaffId, role: "staff", status: "active", line_subject: null, auth_user_id: "auth-other" },
  "customer-session": { id: customerId, role: "customer", status: "active", line_subject: "U_customer", auth_user_id: null },
  "other-customer-session": { id: otherCustomerId, role: "customer", status: "active", line_subject: "U_other", auth_user_id: null },
};
const sessions = new Map(Object.entries(accounts).map(([token, account]) => [createHash("sha256").update(token).digest("hex"), account]));
const services = [
  { id: storeA, account_id: staffId, name: "ร้านต้นผึ้ง", category: "community_product" },
  { id: storeB, account_id: otherStaffId, name: "ร้านริมป่า", category: "community_product" },
];
const products = new Map([[productA, { id: productA, service_id: storeA, name: "น้ำผึ้งป่า", price_satang: 12550, active: true }]]);
let customerCart: { customer: string; service_id: string; items: Array<{ product_id: string; quantity: number }>; fulfillment: string; address: string } | null = null;
const orders = new Map<string, Record<string, unknown>>();
let supabase: Server;

async function readBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
function send(response: import("node:http").ServerResponse, status: number, value?: unknown) {
  response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  response.end(value === undefined ? undefined : JSON.stringify(value));
}
const rpcError = (response: import("node:http").ServerResponse, code: string, message: string) => send(response, 400, { code, message, details: message, hint: null });
const eq = (url: URL, key: string) => url.searchParams.get(key)?.slice(3);

/** Mirrors migration 008: server-side pricing from the saved cart, request UUID replay, owner checks and simulated payment. */
function computeCart() {
  const lines = customerCart!.items.map((item) => { const product = products.get(item.product_id)!; return { product_id: product.id, name: product.name, price_satang: product.price_satang, quantity: item.quantity, line_total_satang: product.price_satang * item.quantity }; });
  const subtotal = lines.reduce((sum, line) => sum + line.line_total_satang, 0); const shipping = customerCart!.fulfillment === "delivery" ? 5000 : 0;
  return { available: true, service_id: customerCart!.service_id, store_name: services.find((item) => item.id === customerCart!.service_id)!.name, items: lines, fulfillment: customerCart!.fulfillment, address: customerCart!.address, subtotal_satang: subtotal, shipping_satang: shipping, total_satang: subtotal + shipping };
}

test.beforeAll(async () => {
  supabase = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:4174");
    const text = await readBody(request);
    const input = text ? JSON.parse(text) as Record<string, unknown> : {};
    if (request.method === "OPTIONS") { response.writeHead(204, { "access-control-allow-origin": "http://127.0.0.1:4173", "access-control-allow-methods": "GET, POST, PATCH, OPTIONS", "access-control-allow-headers": "authorization, apikey, content-type" }); return response.end(); }
    if (url.pathname === "/rest/v1/app_sessions") {
      const account = sessions.get(eq(url, "token_hash") ?? "");
      return send(response, 200, account ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: account } : null);
    }
    if (url.pathname === "/rest/v1/services" && request.method === "GET") return send(response, 200, services.filter((service) => service.account_id === eq(url, "account_id")));
    if (url.pathname === "/rest/v1/rpc/save_customer_cart") {
      if (customerCart && customerCart.service_id !== input.target_service_id) return rpcError(response, "P0001", "cart store mismatch");
      customerCart = { customer: String(input.target_customer_id), service_id: String(input.target_service_id), items: input.target_items as Array<{ product_id: string; quantity: number }>, fulfillment: String(input.target_fulfillment), address: String(input.target_address) };
      return send(response, 200, computeCart());
    }
    if (url.pathname === "/rest/v1/rpc/read_customer_cart") return send(response, 200, customerCart?.customer === input.target_customer_id ? computeCart() : null);
    if (url.pathname === "/rest/v1/rpc/create_product_order") {
      const existing = [...orders.values()].find((order) => order.customer_account_id === input.target_customer_id && order.request_id === input.target_request_id);
      if (existing) return existing.expected_service_id === input.target_expected_service_id ? send(response, 200, existing) : rpcError(response, "23505", "request id reused");
      if (!customerCart || customerCart.customer !== input.target_customer_id) return rpcError(response, "P0002", "cart empty");
      if (customerCart.service_id !== input.target_expected_service_id) return rpcError(response, "40001", "cart changed");
      const cart = computeCart();
      const id = `99999999-9999-4999-8999-${String(orders.size + 1).padStart(12, "0")}`;
      const order = { id, customer_account_id: input.target_customer_id, request_id: input.target_request_id, expected_service_id: input.target_expected_service_id,
        service_id: cart.service_id, store_name: cart.store_name, fulfillment: cart.fulfillment, delivery_address: cart.address, subtotal_satang: cart.subtotal_satang,
        shipping_satang: cart.shipping_satang, total_satang: cart.total_satang, payment_method: "simulated_demo", payment_status: "pending_simulated", status: "pending_payment",
        tracking_number: null, created_at: new Date().toISOString(), paid_at: null, status_updated_at: new Date().toISOString(),
        items: cart.items.map((line) => ({ product_id: line.product_id, product_name: line.name, unit_price_satang: line.price_satang, quantity: line.quantity, line_total_satang: line.line_total_satang })) };
      orders.set(id, order); customerCart = null;
      return send(response, 200, order);
    }
    if (url.pathname === "/rest/v1/rpc/confirm_product_order") {
      const order = orders.get(String(input.target_order_id));
      if (!order || order.customer_account_id !== input.target_customer_id) return rpcError(response, "P0002", "order not found");
      if (order.payment_status === "pending_simulated") Object.assign(order, { payment_status: "paid_simulated", status: "paid", paid_at: new Date().toISOString() });
      return send(response, 200, order);
    }
    if (url.pathname === "/rest/v1/rpc/update_staff_product_order") {
      const order = orders.get(String(input.target_order_id));
      const store = services.find((service) => service.account_id === input.target_staff_id);
      if (!order || !store || order.service_id !== store.id || order.payment_status !== "paid_simulated") return rpcError(response, "42501", "order not found");
      if (order.fulfillment === "pickup" && input.target_tracking_number) return rpcError(response, "22023", "tracking number not allowed for pickup");
      Object.assign(order, { status: input.target_status, tracking_number: input.target_tracking_number ?? null, status_updated_at: new Date().toISOString() });
      return send(response, 200, order);
    }
    if (url.pathname === "/rest/v1/product_orders" && request.method === "GET") {
      const filters = ["id", "customer_account_id", "service_id", "payment_status"].map((key) => [key, eq(url, key)] as const).filter(([, value]) => value);
      return send(response, 200, [...orders.values()].filter((order) => filters.every(([key, value]) => order[key] === value)));
    }
    return send(response, 404, { message: `Unhandled ${request.method} ${url.pathname}` });
  });
  await new Promise<void>((resolve) => supabase.listen(4174, "127.0.0.1", resolve));
});

test.afterAll(async () => { await new Promise<void>((resolve, reject) => supabase.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(async ({ page }) => {
  orders.clear(); customerCart = null;
  await page.route("https://**/*", (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
});

async function signIn(page: Page, token: keyof typeof accounts) {
  await page.context().addCookies([{ name: "tonphueng_session", value: token, url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
}
async function call(page: Page, path: string, method: string, body: unknown) {
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as { order?: Record<string, unknown>; error?: string } };
  }, { path, method, body });
}
async function screenshot(page: Page, name: string) {
  const dir = process.env.UI_SCREENSHOT_DIR;
  if (!dir) return;
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: `${dir}/${name}-mobile.png`, fullPage: true });
}

test("Customer buys for delivery, pays by simulation, Staff updates tracking, and My Order shows it after reload", async ({ page }) => {
  customerCart = { customer: customerId, service_id: storeA, items: [{ product_id: productA, quantity: 2 }], fulfillment: "delivery", address: "บ้านเลขที่ 12 บ้านต้นผึ้ง" };
  await signIn(page, "customer-session");
  await page.goto("/cart");
  await expect(page.locator(".cart-grand-total")).toContainText("301.00");
  await page.getByLabel("ที่อยู่จัดส่ง").fill("12");
  await page.getByRole("button", { name: "สั่งซื้อ", exact: true }).click();
  await expect(page.getByText("กรุณากรอกที่อยู่จัดส่งอย่างน้อย 5 ตัวอักษร")).toBeVisible();
  expect(orders.size).toBe(0);
  await page.getByLabel("ที่อยู่จัดส่ง").fill("บ้านเลขที่ 12 บ้านต้นผึ้ง");
  await page.getByLabel("จำนวน น้ำผึ้งป่า").fill("3");
  // One click saves the edited cart (server reprices it) and creates the Order.
  await page.getByRole("button", { name: "สั่งซื้อ", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderId = page.url().split("/").at(-1)!;
  await expect(page.getByRole("heading", { name: "ร้านต้นผึ้ง" })).toBeVisible();
  await expect(page.getByText("฿125.50 × 3")).toBeVisible();
  await expect(page.getByText("บ้านเลขที่ 12 บ้านต้นผึ้ง")).toBeVisible();
  await expect(page.locator(".cart-grand-total")).toContainText("426.50");
  await expect(page.locator('.order-steps [aria-current="step"]')).toHaveText("รอชำระ");
  await expect(page.getByText("สแกน QR เพื่อชำระเงิน")).toBeVisible();
  await expect(page.getByText(/จำลอง|ตัวอย่าง|เดโม|DEMO|สาธิต/)).toHaveCount(0);
  expect(customerCart).toBeNull();
  await screenshot(page, "tonphueng-order-payment");

  const requestId = String(orders.get(orderId)?.request_id);
  const replay = await call(page, "/api/orders", "POST", { request_id: requestId, expected_service_id: storeA });
  expect(replay.status).toBe(201);
  expect(replay.body.order?.id).toBe(orderId);
  const tampered = await call(page, "/api/orders", "POST", { request_id: crypto.randomUUID(), expected_service_id: storeA, total_satang: 1, shipping_satang: 0 });
  expect(tampered.status).toBe(400);
  expect(orders.size).toBe(1);
  expect(orders.get(orderId)?.total_satang).toBe(42650);

  await signIn(page, "staff-session");
  await page.goto("/staff/orders");
  await expect(page.getByText("ยังไม่มีคำสั่งซื้อที่รอดำเนินการ")).toBeVisible();
  await signIn(page, "other-customer-session");
  // loading.tsx streams the page, so a foreign Order is a soft 404: the not-found UI without any Order data.
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByText("บ้านเลขที่ 12 บ้านต้นผึ้ง")).toHaveCount(0);
  expect((await call(page, `/api/orders/${orderId}/confirm`, "POST", {})).status).toBe(404);
  expect(orders.get(orderId)?.payment_status).toBe("pending_simulated");

  await signIn(page, "customer-session");
  await page.goto("/my-order?tab=to-pay");
  await expect(page.locator(".status-badge")).toHaveText("รอชำระเงิน");
  await page.getByRole("link", { name: "ไปชำระเงิน" }).click();
  await page.getByRole("checkbox", { name: /ตรวจสอบรายการและยอดชำระแล้ว/ }).check();
  await page.getByRole("button", { name: "ยืนยันการชำระเงิน" }).click();
  await expect(page.getByRole("heading", { name: "ชำระเงินเรียบร้อย" })).toBeVisible();
  const paidAt = orders.get(orderId)?.paid_at;
  const again = await call(page, `/api/orders/${orderId}/confirm`, "POST", {});
  expect(again.status).toBe(200);
  expect(again.body.order?.paid_at).toBe(paidAt);
  await page.reload();
  await expect(page.getByRole("heading", { name: "ชำระเงินเรียบร้อย" })).toBeVisible();
  await expect(page.locator(".status-badge.status-paid-demo")).toHaveText("ชำระเงินแล้ว");
  await expect(page.locator('.order-steps [aria-current="step"]')).toHaveText("ชำระแล้ว");

  await signIn(page, "other-staff-session");
  await page.goto("/staff/orders");
  await expect(page.getByText("ยังไม่มีคำสั่งซื้อที่รอดำเนินการ")).toBeVisible();
  expect((await call(page, `/api/staff/orders/${orderId}`, "PATCH", { status: "delivered", tracking_number: "" })).status).toBe(404);
  expect(orders.get(orderId)?.status).toBe("paid");

  await signIn(page, "staff-session");
  await page.goto("/staff/orders");
  await expect(page.getByText("น้ำผึ้งป่า")).toBeVisible();
  await expect(page.getByText("จำนวน 3")).toBeVisible();
  await expect(page.getByText("บ้านเลขที่ 12 บ้านต้นผึ้ง")).toBeVisible();
  await expect(page.getByText("สถานะปัจจุบัน: รอร้านรับออเดอร์")).toBeVisible();
  await page.getByLabel("อัปเดตสถานะ").selectOption("shipping");
  await page.getByLabel(/เลขพัสดุ/).fill("TH123456789TH");
  await page.getByRole("button", { name: "บันทึกสถานะ" }).click();
  await expect(page.getByText("บันทึกสถานะแล้ว")).toBeVisible();
  await screenshot(page, "tonphueng-staff-orders");
  expect(orders.get(orderId)).toMatchObject({ status: "shipping", tracking_number: "TH123456789TH" });

  await signIn(page, "customer-session");
  await page.goto("/my-order");
  await page.reload();
  await expect(page.locator(".status-badge").first()).toHaveText("กำลังจัดส่ง");
  await expect(page.locator(".status-badge.status-paid-demo")).toHaveText("ชำระเงินแล้ว");
  await expect(page.getByText("TH123456789TH")).toBeVisible();
  await expect(page.getByText("น้ำผึ้งป่า × 3")).toBeVisible();
  await page.getByRole("link", { name: /^สำเร็จ/ }).click();
  await expect(page.getByText("ไม่มีคำสั่งซื้อในแท็บ “สำเร็จ”")).toBeVisible();
  await page.getByRole("link", { name: /^กำลังจัดส่ง/ }).click();
  await expect(page.getByText("TH123456789TH")).toBeVisible();
  await screenshot(page, "tonphueng-my-order");
  await signIn(page, "other-customer-session");
  await page.goto("/my-order");
  await expect(page.getByText("ยังไม่มีคำสั่งซื้อ")).toBeVisible();
});

test("Pickup Order is completed by Staff without a tracking number", async ({ page }) => {
  customerCart = { customer: customerId, service_id: storeA, items: [{ product_id: productA, quantity: 1 }], fulfillment: "pickup", address: "" };
  await signIn(page, "customer-session");
  await page.goto("/cart");
  await page.getByRole("button", { name: "สั่งซื้อ", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\//);
  const orderId = page.url().split("/").at(-1)!;
  await expect(page.locator(".cart-grand-total")).toContainText("125.50");
  await expect(page.locator(".order-steps")).toContainText("พร้อมรับที่ร้าน");
  await page.getByRole("checkbox", { name: /ตรวจสอบรายการและยอดชำระแล้ว/ }).check();
  await page.getByRole("button", { name: "ยืนยันการชำระเงิน" }).click();
  await expect(page.getByRole("heading", { name: "ชำระเงินเรียบร้อย" })).toBeVisible();

  await signIn(page, "staff-session");
  await page.goto("/staff/orders");
  await expect(page.getByText("ลูกค้ารับที่ร้าน ไม่ต้องกรอกเลขพัสดุ")).toBeVisible();
  await expect(page.getByLabel(/เลขพัสดุ/)).toHaveCount(0);
  const withTracking = await call(page, `/api/staff/orders/${orderId}`, "PATCH", { status: "delivered", tracking_number: "TH1" });
  expect(withTracking.status).toBe(400);
  expect(withTracking.body.error).toContain("รับที่ร้าน");
  await page.getByLabel("อัปเดตสถานะ").selectOption("delivered");
  await page.getByRole("button", { name: "บันทึกสถานะ" }).click();
  await expect(page.getByText("บันทึกสถานะแล้ว")).toBeVisible();
  expect(orders.get(orderId)).toMatchObject({ status: "delivered", tracking_number: null });

  await signIn(page, "customer-session");
  await page.goto("/my-order?tab=done");
  await expect(page.locator(".status-badge").first()).toHaveText("รับสินค้าเรียบร้อย");
  await expect(page.getByText(/เลขพัสดุ/)).toHaveCount(0);
});
