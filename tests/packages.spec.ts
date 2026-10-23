import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const admin = { id: "11111111-1111-4111-8111-111111111111", role: "admin", status: "active", line_subject: "U_admin", auth_user_id: null };
const customer = { id: "22222222-2222-4222-8222-222222222222", role: "customer", status: "active", line_subject: "U_customer", auth_user_id: null };
const staff = { id: "33333333-3333-4333-8333-333333333333", role: "staff", status: "active", line_subject: "U_staff", auth_user_id: null };
const trail = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", account_id: staff.id, name: "เส้นทางตัวอย่าง", category: "tourism_trail" };
const trailAlternative = { id: "acacacac-acac-4cac-8cac-acacacacacac", account_id: staff.id, name: "เส้นทางใหม่", category: "tourism_trail" };
const restaurant = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", account_id: staff.id, name: "ร้านตัวอย่าง", category: "restaurant" };
const sessions = new Map([[createHash("sha256").update("admin-session").digest("hex"), admin], [createHash("sha256").update("customer-session").digest("hex"), customer]]);
const catalogs = new Map<string, { catalog: Record<string, unknown>; revision: number }>();
const selections = new Map<string, Record<string, unknown>>();
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
    const body = await readBody(request);
    const input = () => body ? JSON.parse(body) as Record<string, unknown> : {};
    if (request.method === "OPTIONS") {
      response.writeHead(204, { "access-control-allow-origin": "http://127.0.0.1:4173", "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS", "access-control-allow-headers": "authorization, apikey, content-type" });
      return response.end();
    }
    if (url.pathname === "/rest/v1/app_sessions" && request.method === "GET") {
      const account = sessions.get(url.searchParams.get("token_hash")?.slice(3) ?? "");
      return send(response, 200, account ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: account } : null);
    }
    if (url.pathname === "/rest/v1/app_accounts" && request.method === "GET") {
      if (url.searchParams.get("status") === "eq.pending") return send(response, 200, []);
      const ids = url.searchParams.get("id")?.slice(4, -1).split(",") ?? [];
      const status = url.searchParams.get("status")?.slice(3);
      const role = url.searchParams.get("role")?.slice(3);
      return send(response, 200, [admin, customer, staff].filter((account) => (!ids.length || ids.includes(account.id)) && (!status || account.status === status) && (!role || account.role === role)).map(({ id }) => ({ id })));
    }
    if (url.pathname === "/rest/v1/services" && request.method === "GET") {
      const ids = url.searchParams.get("id")?.slice(4, -1).split(",") ?? [];
      return send(response, 200, [trail, trailAlternative, restaurant].filter((service) => !ids.length || ids.includes(service.id)));
    }
    if (url.pathname === "/rest/v1/package_catalogs" && request.method === "GET") {
      return send(response, 200, [...catalogs.entries()].map(([category, item]) => ({ category, catalog: item.catalog, revision: item.revision })));
    }
    if (url.pathname === "/rest/v1/rpc/save_package_catalog" && request.method === "POST") {
      const value = input();
      const category = String(value.target_category);
      const expected = Number(value.target_expected_revision);
      const existing = catalogs.get(category);
      if ((existing?.revision ?? 0) !== expected) return send(response, 400, { message: "stale revision" });
      const revision = expected + 1;
      catalogs.set(category, { catalog: value.target_catalog as Record<string, unknown>, revision });
      return send(response, 200, revision);
    }
    if (url.pathname === "/rest/v1/package_customer_selections" && request.method === "GET") {
      const owner = url.searchParams.get("customer_account_id")?.slice(3);
      return send(response, 200, [...selections.values()].filter((item) => item.customer_account_id === owner));
    }
    if (url.pathname === "/rest/v1/rpc/save_package_selection" && request.method === "POST") {
      const value = input();
      const category = String(value.target_category);
      const catalog = catalogs.get(category);
      const sub = (catalog?.catalog.sub_packages as Array<Record<string, unknown>> | undefined)?.find((item) => item.id === value.target_sub_package_id);
      if (!catalog || catalog.revision !== Number(value.target_revision) || !sub) return send(response, 400, { message: "stale catalog" });
      const row = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", customer_account_id: value.target_customer_id, category, sub_package_id: value.target_sub_package_id, catalog_revision: catalog.revision, price_per_person_satang: sub.price_per_person_satang, choices: value.target_choices, updated_at: new Date().toISOString() };
      selections.set(`${value.target_customer_id}:${value.target_sub_package_id}`, row);
      return send(response, 200, [row]);
    }
    return send(response, 404, { message: `Unhandled fake Supabase request ${request.method} ${url.pathname}` });
  });
  await new Promise<void>((resolve) => supabase.listen(4174, "127.0.0.1", resolve));
});

test.afterAll(async () => { await new Promise<void>((resolve, reject) => supabase.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(async ({ page, context }) => {
  catalogs.clear(); selections.clear();
  await page.route("https://**/*", (route) => route.abort());
  await context.addCookies([{ name: "tonphueng_session", value: "admin-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
});

test("Admin saves a typed Package; Customer selects, reloads, and gets server validation and price", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const packageSaveBodies: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/admin/packages" && request.method() === "POST") packageSaveBodies.push(JSON.parse(request.postData() ?? "{}") as Record<string, unknown>);
  });
  await page.goto("/admin/packages");
  await expect(page.getByRole("heading", { name: "จัดการ Package และ Sub Package" })).toBeVisible();
  await page.getByLabel("ชื่อ Package").fill("Trail & Running");
  await page.getByRole("button", { name: "เพิ่ม Sub Package" }).click();
  await page.getByLabel("ชื่อ Sub Package").fill("เดินป่าตัวอย่าง");
  await page.getByLabel("รายละเอียด", { exact: true }).fill("เส้นทางตัวอย่างจากบริการที่อนุมัติ");
  const price = page.getByLabel("ราคาต่อคน (บาท)");
  const duration = page.getByLabel("ระยะเวลา (วัน)");
  await price.pressSequentially("1250.50");
  await expect(price).toHaveValue("1250.50");
  await page.getByRole("button", { name: "เพิ่ม slot" }).click();
  await page.getByLabel("ชื่อ slot").fill("เส้นทาง");
  await page.getByRole("checkbox", { name: "เส้นทางตัวอย่าง" }).check();
  const screenshotDir = process.env.UI_SCREENSHOT_DIR;
  if (screenshotDir) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-package-editor-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-package-editor-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await price.fill("");
  await duration.fill("");
  const requiredCount = page.getByLabel("จำนวนที่ต้องเลือก");
  await requiredCount.fill("");
  await expect(price).toHaveValue("");
  await expect(duration).toHaveValue("");
  await expect(requiredCount).toHaveValue("");
  await page.getByRole("button", { name: "บันทึกประเภทนี้" }).click();
  expect(packageSaveBodies).toHaveLength(0);

  await price.pressSequentially("1250.50");
  await duration.fill("3");
  await requiredCount.fill("1");
  await expect(price).toHaveValue("1250.50");
  await expect(duration).toHaveValue("3");
  await expect(requiredCount).toHaveValue("1");
  await page.getByRole("button", { name: "บันทึกประเภทนี้" }).click();
  await expect(page.getByText("บันทึกแพ็กเกจแล้ว")).toBeVisible();
  expect(packageSaveBodies).toHaveLength(1);
  const savedCatalog = packageSaveBodies[0].catalog as { sub_packages: Array<{ price_per_person_satang: number; duration_days: number; slots: Array<{ required_count: number }> }> };
  expect(savedCatalog.sub_packages[0]).toMatchObject({ price_per_person_satang: 125050, duration_days: 3 });
  expect(savedCatalog.sub_packages[0].slots[0].required_count).toBe(1);

  await context.addCookies([{ name: "tonphueng_session", value: "customer-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/packages");
  await expect(page.getByRole("heading", { name: "Trail & Running" })).toBeVisible();
  await page.getByRole("link", { name: /เดินป่าตัวอย่าง/ }).click();
  await page.getByRole("checkbox", { name: "เส้นทางตัวอย่าง" }).check();
  await page.getByRole("button", { name: "บันทึกตัวเลือก" }).click();
  await expect(page.getByText("บันทึกตัวเลือกแล้ว เปิดหน้านี้อีกครั้งเพื่อดูข้อมูลที่บันทึกไว้")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "เส้นทางตัวอย่าง" })).toBeChecked();

  const detailsUrl = page.url();
  await context.addCookies([{ name: "tonphueng_session", value: "admin-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/admin/packages");
  await page.getByRole("checkbox", { name: "เส้นทางตัวอย่าง" }).uncheck();
  await page.getByRole("checkbox", { name: "เส้นทางใหม่" }).check();
  await page.getByRole("button", { name: "บันทึกประเภทนี้" }).click();
  await expect(page.getByText("บันทึกแพ็กเกจแล้ว")).toBeVisible();
  await context.addCookies([{ name: "tonphueng_session", value: "customer-session", url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
  await page.goto(detailsUrl);
  await expect(page.getByText(/ตัวเลือกหรือแพ็กเกจเดิมเปลี่ยนไปแล้ว/)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "เส้นทางใหม่" })).toBeEnabled();
  await page.getByRole("checkbox", { name: "เส้นทางใหม่" }).check();
  await page.getByRole("button", { name: "บันทึกการแก้ไขตัวเลือก" }).click();
  await expect(page.getByText("บันทึกตัวเลือกแล้ว เปิดหน้านี้อีกครั้งเพื่อดูข้อมูลที่บันทึกไว้")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "เส้นทางใหม่" })).toBeChecked();

  const invalidStatus = await page.evaluate(async () => {
    const data = await (await fetch("/api/packages")).json() as { categories: Array<{ category: string; revision: number; sub_packages: Array<{ id: string; slots: Array<{ id: string }> }> }> };
    const item = data.categories.find((category) => category.category === "trail_running")!;
    const sub = item.sub_packages[0];
    return (await fetch("/api/packages/selection", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: item.category, revision: item.revision, sub_package_id: sub.id, choices: [] }) })).status;
  });
  expect(invalidStatus).toBe(400);
  await page.goto("/");
  await expect(page.getByText(/เปิด My Trip เพื่อดูสถานที่และตัวเลือกแพ็กเกจที่บันทึกไว้/)).toBeVisible();
});
