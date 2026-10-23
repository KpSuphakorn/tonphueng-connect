import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const admin = { id: "11111111-1111-4111-8111-111111111111", role: "admin", status: "active", line_subject: "U_admin", auth_user_id: null };
const customer = { id: "22222222-2222-4222-8222-222222222222", role: "customer", status: "active", line_subject: "U_customer", auth_user_id: null };
const staff = { id: "33333333-3333-4333-8333-333333333333", role: "staff", status: "active", line_subject: "U_staff", auth_user_id: null };
const subId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const slotId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const trailId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const category = "trail_running";
const catalog = { title: "Trail & Running", description: "ตัวอย่าง", contact_url: "", sub_packages: [{ id: subId, title: "เดินป่าสองวัน", description: "", price_per_person_satang: 125050, duration_days: 2, slots: [{ id: slotId, name: "เส้นทาง", service_category: "tourism_trail", required_count: 1, service_ids: [trailId] }] }] };
const service = { id: trailId, account_id: staff.id, name: "เส้นทางตัวอย่าง", description: "", address: "บ้านต้นผึ้ง", latitude: 18, longitude: 99, phone: "000", category: "tourism_trail", other_category: null, photo_paths: [], created_at: "2026-10-23" };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sessions = new Map([[hash("admin-session"), admin], [hash("customer-session"), customer]]);
const bookings = new Map<string, Record<string, unknown>>();
const trips = new Map<string, Array<Record<string, unknown>>>();
let failNextCreateResponse = false;
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

test.beforeAll(async () => {
  supabase = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:4174");
    const text = await readBody(request);
    const input = () => text ? JSON.parse(text) as Record<string, unknown> : {};
    if (request.method === "OPTIONS") { response.writeHead(204, { "access-control-allow-origin": "http://127.0.0.1:4173", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "authorization, apikey, content-type" }); return response.end(); }
    if (url.pathname === "/rest/v1/app_sessions" && request.method === "GET") {
      const account = sessions.get(url.searchParams.get("token_hash")?.slice(3) ?? "");
      return send(response, 200, account ? { expires_at: "2999-01-01T00:00:00Z", app_accounts: account } : null);
    }
    if (url.pathname === "/rest/v1/package_catalogs" && request.method === "GET") return send(response, 200, [{ category, catalog, revision: 1 }]);
    if (url.pathname === "/rest/v1/services" && request.method === "GET") return send(response, 200, [service]);
    if (url.pathname === "/rest/v1/app_accounts" && request.method === "GET") return send(response, 200, [{ id: staff.id }]);
    if (url.pathname === "/rest/v1/package_customer_selections" && request.method === "GET") return send(response, 200, []);
    if (url.pathname === "/rest/v1/rpc/create_package_booking" && request.method === "POST") {
      if (bookings.size) {
        const value = input();
        const existing = [...bookings.values()].find((row) => row.customer_account_id === value.target_customer_id && row.request_id === value.target_request_id);
        if (existing) return send(response, 200, existing);
      }
      const value = input();
      const existing = [...bookings.values()].find((row) => row.customer_account_id === value.target_customer_id && row.request_id === value.target_request_id);
      if (existing) return send(response, JSON.stringify(existing.request_payload) === JSON.stringify({ category: value.target_category, sub_package_id: value.target_sub_package_id, revision: value.target_revision, choices: value.target_choices, start_date: value.target_start_date, participants: value.target_participants }) ? 200 : 409, existing);
      const sub = catalog.sub_packages[0];
      const row = { id: "99999999-9999-4999-8999-999999999999", customer_account_id: value.target_customer_id, request_id: value.target_request_id,
        request_payload: { category: value.target_category, sub_package_id: value.target_sub_package_id, revision: value.target_revision, choices: value.target_choices, start_date: value.target_start_date, participants: value.target_participants },
        status: "pending", category, sub_package_id: subId, package_snapshot: { package_title: catalog.title, sub_package_title: sub.title, duration_days: 2, choices: [{ slot_name: "เส้นทาง", service: { id: trailId, name: service.name, address: service.address } }] },
        start_date: value.target_start_date, end_date: "2099-01-16", participants: value.target_participants, price_per_person_satang: sub.price_per_person_satang,
        total_price_satang: Number(value.target_participants) * sub.price_per_person_satang, created_at: new Date().toISOString(), confirmed_at: null, my_trip_added_at: null };
      bookings.set(row.id, row);
      if (failNextCreateResponse) { failNextCreateResponse = false; return send(response, 503, { message: "response lost after commit" }); }
      return send(response, 200, row);
    }
    if (url.pathname === "/rest/v1/rpc/confirm_package_booking" && request.method === "POST") {
      const row = [...bookings.values()].find((item) => item.id === input().target_booking_id && item.customer_account_id === input().target_customer_id);
      if (!row) return send(response, 404, { message: "not found" });
      row.status = "paid_simulated"; row.confirmed_at ??= new Date().toISOString(); return send(response, 200, row);
    }
    if (url.pathname === "/rest/v1/rpc/add_booking_to_my_trip" && request.method === "POST") {
      const row = [...bookings.values()].find((item) => item.id === input().target_booking_id && item.customer_account_id === input().target_customer_id && item.status === "paid_simulated");
      if (!row) return send(response, 404, { message: "not found" });
      row.my_trip_added_at ??= new Date().toISOString();
      trips.set(row.id as string, [{ booking_id: row.id, service_id: trailId, service_snapshot: { id: trailId, name: service.name, address: service.address } }]);
      return send(response, 200, row);
    }
    if (url.pathname === "/rest/v1/package_bookings" && request.method === "GET") {
      const owner = url.searchParams.get("customer_account_id")?.slice(3);
      return send(response, 200, [...bookings.values()].filter((row) => !owner || row.customer_account_id === owner));
    }
    if (url.pathname === "/rest/v1/my_trip_booking_services" && request.method === "GET") {
      const owner = url.searchParams.get("customer_account_id")?.slice(3);
      return send(response, 200, [...trips.values()].flat().filter((item) => [...bookings.values()].some((row) => row.id === item.booking_id && row.customer_account_id === owner)));
    }
    if (url.pathname === "/rest/v1/my_trip_saved_services" && request.method === "GET") return send(response, 200, []);
    return send(response, 404, { message: `Unhandled ${request.method} ${url.pathname}` });
  });
  await new Promise<void>((resolve) => supabase.listen(4174, "127.0.0.1", resolve));
});

test.afterAll(async () => { await new Promise<void>((resolve, reject) => supabase.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(async ({ page, context }) => {
  bookings.clear(); trips.clear(); failNextCreateResponse = false;
  await page.route("https://**/*", (route) => route.abort());
  await context.addCookies([{ name: "tonphueng_session", value: "customer-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
});

test("Customer reviews the server price, confirms the demo, and adds the booked place to My Trip; Admin sees the booking", async ({ page, context }) => {
  const screenshotDir = process.env.UI_SCREENSHOT_DIR;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/packages/${subId}`);
  await page.getByRole("checkbox", { name: "เส้นทางตัวอย่าง" }).check();
  await page.getByLabel("วันเริ่มทริป").fill("2099-01-15");
  await page.getByLabel("จำนวนผู้เข้าร่วม").fill("2");
  failNextCreateResponse = true;
  await page.getByRole("button", { name: "ตรวจราคาและไปหน้าจ่ายจำลอง" }).click();
  await expect(page.getByText("บันทึกการจองไม่สำเร็จ กรุณาลองใหม่")).toBeVisible();
  await page.getByRole("button", { name: "ตรวจราคาและไปหน้าจ่ายจำลอง" }).click();
  expect(bookings.size).toBe(1);
  await expect(page.locator(".booking-summary p").filter({ hasText: "ยอดรวมจากระบบ" })).toContainText("2,501.00");
  await expect(page.getByText(/ตรวจสอบยอดกับธนาคาร/)).toBeVisible();
  if (screenshotDir) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-booking-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-booking-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.goto("/my-trip");
  await expect(page.getByText(/รอยืนยันจ่ายจำลอง/)).toBeVisible();
  await page.getByRole("link", { name: "ดูรายละเอียดการจอง" }).click();
  await expect(page.getByRole("heading", { name: "เดินป่าสองวัน" })).toBeVisible();
  await page.getByRole("checkbox", { name: /เข้าใจว่านี่เป็นการสาธิต/ }).check();
  await page.getByRole("button", { name: "ยืนยันจ่ายเงินจำลอง" }).click();
  await expect(page.getByText("ยืนยันจ่ายเงินจำลองแล้ว")).toBeVisible();
  await page.getByRole("button", { name: "เพิ่มสถานที่ทั้งหมดเข้า My Trip" }).click();
  await expect(page.getByText("เพิ่มสถานที่ทั้งหมดเข้า My Trip แล้ว")).toBeVisible();
  await page.goto("/my-trip");
  await expect(page.getByRole("heading", { name: "ทริปที่จองแล้ว" })).toBeVisible();
  await expect(page.getByText("เส้นทางตัวอย่าง")).toBeVisible();
  if (screenshotDir) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-my-trip-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-my-trip-desktop.png` });
  }
  await context.addCookies([{ name: "tonphueng_session", value: "admin-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/admin/bookings");
  await expect(page.getByRole("heading", { name: "รายการจองแพ็กเกจ" })).toBeVisible();
  await expect(page.getByText("เดินป่าสองวัน")).toBeVisible();
});
