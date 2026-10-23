import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { expect, test } from "@playwright/test";

const staffId = "33333333-3333-4333-8333-333333333333";
const otherStaffId = "44444444-4444-4444-8444-444444444444";
const customerId = "22222222-2222-4222-8222-222222222222";
const storeA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const storeB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const productA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const productB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const staff = { id: staffId, role: "staff", status: "active", line_subject: null, auth_user_id: "auth-staff" };
const otherStaff = { id: otherStaffId, role: "staff", status: "active", line_subject: null, auth_user_id: "auth-other" };
const customer = { id: customerId, role: "customer", status: "active", line_subject: "U_customer", auth_user_id: null };
const accounts = [staff, otherStaff, customer];
const services = [
  { id: storeA, account_id: staffId, name: "ร้านต้นผึ้ง", address: "บ้านต้นผึ้ง", category: "community_product" },
  { id: storeB, account_id: otherStaffId, name: "ร้านริมป่า", address: "บ้านใกล้ป่า", category: "community_product" },
];
let png: Buffer;
const sessions = new Map(["staff-session", "other-staff-session", "customer-session"].map((token) => [createHash("sha256").update(token).digest("hex"), token === "staff-session" ? staff : token === "other-staff-session" ? otherStaff : customer]));
const products = new Map<string, Record<string, unknown>>();
const stagedPhotos = new Map<string, Buffer>();
const finalPhotos = new Map<string, Buffer>();
let customerCart: Record<string, unknown> | null = null;
let currentStagingPath = "";
let supabase: Server;

async function body(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
function json(response: import("node:http").ServerResponse, status: number, value?: unknown) {
  response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  response.end(value === undefined ? undefined : JSON.stringify(value));
}
function activeProducts(serviceId: string) { return [...products.values()].filter((item) => item.service_id === serviceId && item.active); }
function rpcError(response: import("node:http").ServerResponse, code: string, message: string) { json(response, 400, { code, message, details: message, hint: null }); }

test.beforeAll(async () => {
  png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#b86d36" } }).png().toBuffer();
  supabase = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:4174");
    const raw = await body(request);
    const text = raw.toString("utf8");
    const input = () => text ? JSON.parse(text) as Record<string, unknown> : {};
    if (request.method === "OPTIONS") { response.writeHead(204, { "access-control-allow-origin": "http://127.0.0.1:4173", "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS", "access-control-allow-headers": "authorization, apikey, content-type" }); return response.end(); }
    if (url.pathname === "/rest/v1/app_sessions") {
      const account = sessions.get(url.searchParams.get("token_hash")?.slice(3) ?? "");
      return json(response, 200, account ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: account } : null);
    }
    if (url.pathname === "/rest/v1/app_accounts" && request.method === "GET") {
      const role = url.searchParams.get("role")?.slice(3); const status = url.searchParams.get("status")?.slice(3);
      const result = accounts.filter((account) => (!role || account.role === role) && (!status || account.status === status)).map(({ id }) => ({ id }));
      return json(response, 200, result);
    }
    if (url.pathname === "/rest/v1/services" && request.method === "GET") {
      let rows = services;
      const accountFilter = url.searchParams.get("account_id");
      const idFilter = url.searchParams.get("id")?.slice(4, -1).split(",");
      const category = url.searchParams.get("category")?.slice(3);
      if (accountFilter?.startsWith("eq.")) rows = rows.filter((service) => service.account_id === accountFilter.slice(3));
      if (accountFilter?.startsWith("in.")) rows = rows.filter((service) => accountFilter.slice(4, -1).split(",").includes(service.account_id));
      if (idFilter) rows = rows.filter((service) => idFilter.includes(service.id));
      if (category) rows = rows.filter((service) => service.category === category);
      return json(response, 200, accountFilter?.startsWith("eq.") ? rows[0] ?? null : rows);
    }
    if (url.pathname === "/rest/v1/products" && request.method === "GET") {
      const serviceId = url.searchParams.get("service_id")?.slice(3); const active = url.searchParams.get("active")?.slice(3);
      let rows = [...products.values()].filter((item) => (!serviceId || item.service_id === serviceId) && (active !== "true" || item.active));
      if (url.searchParams.get("select") === "service_id") rows = rows.map((item) => ({ service_id: item.service_id }));
      if (url.searchParams.has("id")) rows = rows.filter((item) => item.id === url.searchParams.get("id")?.slice(3));
      return json(response, 200, url.searchParams.has("id") ? rows[0] ?? null : rows);
    }
    if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && request.method === "GET") return json(response, 200, []);
    if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && request.method === "PATCH") return json(response, 204);
    if (url.pathname === "/rest/v1/rpc/create_staff_photo_upload_session") return json(response, 204);
    if (url.pathname === "/rest/v1/rpc/claim_staff_photo_upload_session") {
      const value = input();
      if (value.target_flow !== "product" || ![staffId, otherStaffId].includes(String(value.target_account_id))) return json(response, 200, []);
      return json(response, 200, [{ id: "upload-session", staging_paths: [currentStagingPath], expires_at: "2999-01-01T00:00:00Z" }]);
    }
    if (url.pathname === "/rest/v1/rpc/save_staff_product") {
      const value = input(); const owner = String(value.target_account_id);
      const service = services.find((item) => item.account_id === owner && item.category === "community_product");
      if (!service) return rpcError(response, "42501", "staff or store unavailable");
      let row = value.target_product_id ? products.get(String(value.target_product_id)) : undefined;
      if (row && row.service_id !== service.id) return rpcError(response, "42501", "product not found");
      const id = row?.id as string ?? productA;
      row = { id, service_id: service.id, name: value.target_name, description: value.target_description, price_satang: value.target_price_satang,
        photo_path: value.target_keep_photo ? row?.photo_path : value.target_photo_path, active: true, updated_at: new Date().toISOString() };
      products.set(id, row);
      return json(response, 200, [row]);
    }
    if (url.pathname === "/rest/v1/rpc/archive_staff_product") {
      const value = input(); const row = products.get(String(value.target_product_id));
      const service = services.find((item) => item.account_id === String(value.target_account_id));
      if (!row || !service || row.service_id !== service.id) return rpcError(response, "42501", "product not found");
      row.active = false; return json(response, 204);
    }
    if (url.pathname === "/rest/v1/rpc/read_customer_cart") {
      if (!customerCart) return json(response, 200, null);
      const service = services.find((item) => item.id === customerCart?.service_id);
      const cartItems = customerCart.items as Array<{ product_id: string; quantity: number }>;
      const loaded = cartItems.map((item) => products.get(item.product_id)).filter(Boolean) as Array<Record<string, unknown>>;
      if (!service || loaded.length !== cartItems.length || loaded.some((item) => !item.active)) return json(response, 200, { available: false, service_id: customerCart.service_id, store_name: service?.name ?? "ร้านค้า", items: cartItems });
      return json(response, 200, computeCart(customerCart.service_id as string, cartItems, customerCart.fulfillment as string, customerCart.address as string));
    }
    if (url.pathname === "/rest/v1/rpc/save_customer_cart") {
      const value = input(); const service = services.find((item) => item.id === value.target_service_id && item.category === "community_product");
      if (!service || !accounts.some((account) => account.role === "staff" && account.id === service.account_id && account.status === "active")) return rpcError(response, "22023", "store unavailable");
      if (customerCart && customerCart.service_id !== value.target_service_id) return rpcError(response, "P0001", "cart store mismatch");
      const cartItems = value.target_items as Array<{ product_id: string; quantity: number }>;
      const rows = cartItems.map((item) => products.get(item.product_id));
      if (rows.some((row) => !row || !row.active || row.service_id !== service.id)) return rpcError(response, "22023", "product unavailable");
      customerCart = { service_id: service.id, items: cartItems, fulfillment: value.target_fulfillment, address: value.target_address };
      return json(response, 200, computeCart(service.id, cartItems, String(value.target_fulfillment), String(value.target_address)));
    }
    if (url.pathname === "/rest/v1/rpc/clear_customer_cart") {
      const value = input();
      if (customerCart && customerCart.service_id !== value.target_expected_service_id) return rpcError(response, "40001", "cart changed");
      customerCart = null; return json(response, 204);
    }
    if (url.pathname.startsWith("/storage/v1/object/upload/sign/staff-photo-staging/") && request.method === "POST") {
      const path = url.pathname.split("/object/upload/sign/")[1];
      return json(response, 200, { url: `/object/upload/sign/${path}?token=upload-token` });
    }
    if (url.pathname.startsWith("/storage/v1/object/upload/sign/staff-photo-staging/") && request.method === "PUT") {
      const path = decodeURIComponent(url.pathname.split("/staff-photo-staging/")[1]); currentStagingPath = path; stagedPhotos.set(path, raw); return json(response, 200, { Key: path });
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/staff-photo-staging/") && request.method === "POST") {
      const path = decodeURIComponent(url.pathname.split("/staff-photo-staging/")[1]); return json(response, 200, { signedURL: `/object/sign/staff-photo-staging/${path}?token=read` });
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/staff-photo-staging/") && request.method === "GET") {
      const path = decodeURIComponent(url.pathname.split("/staff-photo-staging/")[1].split("?")[0]); const photo = stagedPhotos.get(path);
      response.writeHead(photo ? 200 : 404, { "content-type": "image/png" }); return response.end(photo);
    }
    if (url.pathname.startsWith("/storage/v1/object/staff-business-photos/") && request.method === "POST") {
      const path = decodeURIComponent(url.pathname.split("/staff-business-photos/")[1]); finalPhotos.set(path, raw); return json(response, 200, { Key: path });
    }
    if (url.pathname === "/storage/v1/object/sign/staff-business-photos" && request.method === "POST") {
      const paths = (input().paths ?? []) as string[]; return json(response, 200, paths.map((path) => ({ signedURL: `/object/sign/staff-business-photos/${path}?token=read` })));
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/staff-business-photos/") && request.method === "GET") {
      const path = decodeURIComponent(url.pathname.split("/staff-business-photos/")[1].split("?")[0]); const photo = finalPhotos.get(path);
      response.writeHead(photo ? 200 : 404, { "content-type": "image/webp" }); return response.end(photo);
    }
    return json(response, 404, { message: `Unhandled ${request.method} ${url.pathname}` });
  });
  await new Promise<void>((resolve) => supabase.listen(4174, "127.0.0.1", resolve));
});

function computeCart(serviceId: string, items: Array<{ product_id: string; quantity: number }>, fulfillment: string, address: string) {
  const service = services.find((item) => item.id === serviceId)!;
  const lines = items.map((item) => { const product = products.get(item.product_id)!; return { product_id: product.id, name: product.name, price_satang: product.price_satang, quantity: item.quantity, line_total_satang: Number(product.price_satang) * item.quantity }; });
  const subtotal = lines.reduce((sum, line) => sum + line.line_total_satang, 0); const shipping = fulfillment === "delivery" ? 5000 : 0;
  return { available: true, service_id: serviceId, store_name: service.name, items: lines, fulfillment, address, subtotal_satang: subtotal, shipping_satang: shipping, total_satang: subtotal + shipping };
}

test.afterAll(async () => { await new Promise<void>((resolve, reject) => supabase.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(async ({ page, context }) => {
  products.clear(); stagedPhotos.clear(); finalPhotos.clear(); customerCart = null; currentStagingPath = "";
  products.set(productB, { id: productB, service_id: storeB, name: "ชาสมุนไพร", description: "ตัวอย่าง", price_satang: 9000, photo_path: `${otherStaffId}/dddddddd-dddd-4ddd-8ddd-ddddddddddde.webp`, active: true, updated_at: new Date().toISOString() });
  finalPhotos.set(`${otherStaffId}/dddddddd-dddd-4ddd-8ddd-ddddddddddde.webp`, Buffer.from("webp"));
  await page.route("https://**/*", (route) => route.abort());
  await context.addCookies([{ name: "tonphueng_session", value: "staff-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
});

test("Staff uploads one private Product photo and Customer maintains a server-priced single-store cart", async ({ page, context }) => {
  const screenshotDir = process.env.UI_SCREENSHOT_DIR;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/staff/products");
  await page.getByLabel("ชื่อสินค้า").fill("น้ำผึ้งป่า");
  await page.getByLabel("รายละเอียด").fill("น้ำผึ้งตัวอย่างจากบ้านต้นผึ้ง");
  await page.getByLabel(/ราคา \(บาท\)/).fill("125.50");
  await page.getByLabel("รูปสินค้า").setInputFiles({ name: "honey.png", mimeType: "image/png", buffer: png });
  if (screenshotDir) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-product-editor-filled-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-product-editor-filled-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.getByRole("button", { name: "เพิ่มสินค้า" }).click();
  await expect(page.getByText("น้ำผึ้งป่า", { exact: true })).toBeVisible();
  expect(products.get(productA)?.price_satang).toBe(12550);
  expect([...finalPhotos.keys()].some((path) => path.startsWith(`${staffId}/`))).toBe(true);

  await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
  const priceDraft = page.getByLabel(/ราคา \(บาท\)/);
  await priceDraft.fill("");
  await expect(priceDraft).toHaveValue("");
  expect(await priceDraft.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);
  await expect(page.getByText("น้ำผึ้งป่า", { exact: true })).toBeVisible();
  await priceDraft.fill("130.00");
  await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
  await expect(page.getByText("บันทึกสินค้าแล้ว")).toBeVisible();
  expect(products.get(productA)?.price_satang).toBe(13000);

  const invalidUpload = await page.evaluate(async () => (await fetch("/api/staff/photo-uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ flow: "product", count: 2 }) })).status);
  expect(invalidUpload).toBe(400);
  await context.addCookies([{ name: "tonphueng_session", value: "other-staff-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
  const beforeForeignEdit = products.get(productA)?.name;
  const foreignEdit = await page.evaluate(async (id) => {
    const form = new FormData(); form.set("id", id); form.set("name", "แก้ข้ามร้าน"); form.set("description", ""); form.set("price_baht", "1.00"); form.set("upload_session", "");
    return (await fetch("/api/staff/products", { method: "PUT", body: form })).status;
  }, productA);
  expect(foreignEdit).toBe(404);
  expect(products.get(productA)?.name).toBe(beforeForeignEdit);
  await page.goto("/staff/products");
  await expect(page.getByText("ชาสมุนไพร")).toBeVisible();
  await expect(page.getByText("น้ำผึ้งป่า")).toHaveCount(0);

  await context.addCookies([{ name: "tonphueng_session", value: "customer-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`/products/${storeA}`);
  await page.getByLabel("จำนวน น้ำผึ้งป่า").fill("2"); await page.getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await expect(page.getByText("น้ำผึ้งป่า อยู่ในตะกร้าแล้ว")).toBeVisible();
  await page.goto("/cart");
  await expect(page.locator(".cart-total-list").getByText("260.00", { exact: false }).first()).toBeVisible();
  await page.getByLabel("จัดส่ง · ค่าส่ง ฿50.00").check();
  await page.getByLabel("ที่อยู่จัดส่ง").fill("บ้านเลขที่ 12 บ้านต้นผึ้ง");
  await page.getByRole("button", { name: "บันทึกตะกร้าและคำนวณใหม่" }).click();
  await expect(page.getByText("ยอดรวมปัจจุบัน")).toBeVisible();
  await expect(page.getByText("฿310.00", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("จัดส่ง · ค่าส่ง ฿50.00")).toBeChecked();
  if (screenshotDir) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-cart-delivery-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-cart-delivery-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.getByLabel("รับที่ร้าน · ไม่มีค่าส่ง").check(); await page.getByRole("button", { name: "บันทึกตะกร้าและคำนวณใหม่" }).click();
  await expect(page.getByText("฿260.00", { exact: false })).toBeVisible();
  await page.goto(`/products/${storeB}`); await page.getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await expect(page.getByRole("heading", { name: "เปลี่ยนร้านในตะกร้า?" })).toBeVisible();
  await page.getByRole("button", { name: "เก็บตะกร้าเดิม" }).click(); await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "ร้านต้นผึ้ง" })).toBeVisible();
  await page.goto(`/products/${storeB}`); await page.getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await page.getByRole("button", { name: "ล้างและเปลี่ยนร้าน" }).click();
  await expect(page.getByText("เปลี่ยนมาใช้ตะกร้าร้าน ร้านริมป่า แล้ว")).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "ร้านริมป่า" })).toBeVisible();
  const tampered = await page.evaluate(async (serviceId) => (await fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: serviceId, items: [{ product_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", quantity: 1, price_satang: 1 }], fulfillment: "pickup", address: "", shipping_satang: 0 }) })).status, storeB);
  expect(tampered).toBe(400);
  await page.reload(); await expect(page.getByRole("heading", { name: "ร้านริมป่า" })).toBeVisible();

  await context.addCookies([{ name: "tonphueng_session", value: "other-staff-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/staff/products");
  await expect(page.getByText("ชาสมุนไพร")).toBeVisible();
  await page.getByRole("button", { name: "นำออก" }).click();
  await expect(page.getByText("นำสินค้าออกจากรายการแล้ว")).toBeVisible();
  await page.reload();
  await expect(page.getByText("ชาสมุนไพร")).toHaveCount(0);
  await expect(page.getByText("ยังไม่มีสินค้า")).toBeVisible();

  await context.addCookies([{ name: "tonphueng_session", value: "customer-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/cart");
  await expect(page.locator(".error-message")).toContainText("ร้านไม่เปิดใช้งานแล้ว");
  await expect(page.locator(".cart-total-list")).toHaveCount(0);
});
