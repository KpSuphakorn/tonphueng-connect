import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
});

const admin = { id: "11111111-1111-4111-8111-111111111111", role: "admin", status: "active", line_subject: "U_admin", auth_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", created_at: "2026-01-01T00:00:00.000Z" };
const customerA = { id: "66666666-6666-4666-8666-666666666666", role: "customer", status: "active", line_subject: "U_customer", auth_user_id: null };
const customerB = { id: "77777777-7777-4777-8777-777777777777", role: "customer", status: "active", line_subject: "U_customer_b", auth_user_id: null };
const accounts = new Map<string, Record<string, unknown>>([[admin.id, admin], [customerA.id, customerA], [customerB.id, customerB]]);
const users = new Map<string, { id: string; email: string; password: string }>([[admin.auth_user_id, { id: admin.auth_user_id, email: "owner@example.test", password: "admin-password" }]]);
const sessions = new Map<string, string>();
const profiles = new Map<string, Record<string, unknown>>();
const savedServices = new Map<string, Set<string>>();
const objects = new Set<string>();
const stagedObjects = new Map<string, Buffer>();
const uploadSessions = new Map<string, { id: string; tokenHash: string; flow: string; accountId: string | null; paths: string[]; state: string }>();
let fakeWebp: Buffer;

async function bodyOf(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function send(response: ServerResponse, status: number, body?: unknown, type = "application/json") {
  response.writeHead(status, { "content-type": type, "access-control-allow-origin": "*" });
  response.end(body === undefined ? undefined : type === "application/json" ? JSON.stringify(body) : body as Buffer);
}

const fakeSupabase = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:4174");
  const body = await bodyOf(request);
  const json = () => body.length ? JSON.parse(body.toString("utf8")) as Record<string, unknown> : {};

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "http://127.0.0.1:4173",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type, x-upsert",
      "access-control-max-age": "600",
    });
    return response.end();
  }

  if (url.pathname === "/auth/v1/admin/users" && request.method === "POST") {
    const input = json();
    const user = { id: randomUUID(), email: input.email as string, password: input.password as string };
    users.set(user.id, user);
    return send(response, 200, { id: user.id, email: user.email });
  }
  if (url.pathname.startsWith("/auth/v1/admin/users/") && request.method === "GET") {
    const user = users.get(url.pathname.split("/").at(-1)!);
    return send(response, user ? 200 : 404, user ? { id: user.id, email: user.email } : { message: "user missing" });
  }
  if (url.pathname.startsWith("/auth/v1/admin/users/") && request.method === "DELETE") {
    const id = url.pathname.split("/").at(-1)!;
    users.delete(id);
    for (const [accountId, account] of accounts) if (account.auth_user_id === id) accounts.delete(accountId);
    return send(response, 200, { id });
  }
  if (url.pathname === "/auth/v1/token" && request.method === "POST") {
    const input = json();
    const user = [...users.values()].find((item) => item.email === input.email && item.password === input.password);
    if (!user) return send(response, 400, { message: "invalid credentials" });
    return send(response, 200, { access_token: "external-test-token", token_type: "bearer", expires_in: 3600, refresh_token: "unused", user: { id: user.id, email: user.email } });
  }
  if (url.pathname === "/rest/v1/app_accounts" && request.method === "POST") {
    const input = json();
    const account: Record<string, unknown> = { id: randomUUID(), ...input, created_at: new Date().toISOString() };
    accounts.set(account.id as string, account);
    return send(response, 201, account);
  }
  if (url.pathname === "/rest/v1/app_accounts" && request.method === "GET") {
    if (url.searchParams.get("status") === "eq.pending") {
      const select = url.searchParams.get("select") ?? "";
      if (select.includes("services(") && !select.includes("services!services_account_id_fkey(")) {
        return send(response, 400, { code: "PGRST201", message: "Could not embed because more than one relationship was found for 'app_accounts' and 'services'" });
      }
      const pending = [...accounts.values()].filter((account) => account.role === "staff" && account.status === "pending").map((account) => ({
        id: account.id,
        auth_user_id: account.auth_user_id,
        services: [...profiles.values()].filter((profile) => profile.account_id === account.id),
      }));
      return send(response, 200, pending);
    }
    if (url.searchParams.get("role") === "eq.staff" && url.searchParams.get("status") === "eq.active") {
      return send(response, 200, [...accounts.values()].filter((account) => account.role === "staff" && account.status === "active").map(({ id }) => ({ id })));
    }
    if (url.searchParams.get("id")?.startsWith("eq.")) {
      const account = accounts.get(url.searchParams.get("id")!.slice(3));
      return send(response, 200, account?.role === "staff" && account.status === "active" ? { id: account.id } : null);
    }
    const authUser = url.searchParams.get("auth_user_id")?.slice(3);
    const account = [...accounts.values()].find((item) => item.auth_user_id === authUser);
    return send(response, 200, account ?? null);
  }
  if (url.pathname === "/rest/v1/app_sessions" && request.method === "POST") {
    const session = json();
    sessions.set(session.token_hash as string, session.account_id as string);
    return send(response, 201, session);
  }
  if (url.pathname === "/rest/v1/app_sessions" && request.method === "GET") {
    const hash = url.searchParams.get("token_hash")?.slice(3);
    const account = accounts.get(sessions.get(hash ?? "") ?? "");
    return send(response, 200, account ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: account } : null);
  }
  if (url.pathname === "/rest/v1/rpc/approve_staff_account" && request.method === "POST") {
    const input = json();
    const account = accounts.get(input.target_account_id as string);
    if (!account || account.role !== "staff" || account.status !== "pending") return send(response, 200, []);
    account.status = "active";
    return send(response, 200, [{ id: account.id, role: account.role, status: account.status }]);
  }
  if (url.pathname === "/rest/v1/rpc/create_staff_photo_upload_session" && request.method === "POST") {
    const input = json();
    uploadSessions.set(input.target_id as string, {
      id: input.target_id as string,
      tokenHash: input.target_token_hash as string,
      flow: input.target_flow as string,
      accountId: input.target_account_id as string | null,
      paths: input.target_staging_paths as string[],
      state: "issued",
    });
    return send(response, 204);
  }
  if (url.pathname === "/rest/v1/rpc/claim_staff_photo_upload_session" && request.method === "POST") {
    const input = json();
    const session = [...uploadSessions.values()].find((item) => item.tokenHash === input.target_token_hash && item.flow === input.target_flow && item.accountId === (input.target_account_id as string | null) && item.state === "issued");
    if (!session) return send(response, 200, []);
    session.state = "claimed";
    return send(response, 200, [{ id: session.id, staging_paths: session.paths, expires_at: "2999-01-01T00:00:00.000Z" }]);
  }
  if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && request.method === "GET") return send(response, 200, []);
  if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && request.method === "PATCH") return send(response, 204);
  if (url.pathname === "/rest/v1/services" && request.method === "POST") {
    const input = json();
    const profile: Record<string, unknown> = { id: randomUUID(), ...input };
    profiles.set(profile.account_id as string, profile);
    return send(response, 201, profile);
  }
  if (url.pathname === "/rest/v1/services" && request.method === "GET") {
    const accountFilter = url.searchParams.get("account_id") ?? "";
    const accountId = accountFilter.startsWith("eq.") ? accountFilter.slice(3) : "";
    if (accountId) return send(response, 200, profiles.get(accountId) ?? null);
    const accountList = accountFilter.match(/in\.\((.*)\)/)?.[1]?.split(",") ?? [...accounts.values()].filter((account) => account.role === "staff" && account.status === "active").map((account) => account.id as string);
    const serviceFilter = url.searchParams.get("id") ?? "";
    const serviceId = serviceFilter.startsWith("eq.") ? serviceFilter.slice(3) : "";
    if (serviceId) return send(response, 200, [...profiles.values()].find((profile) => profile.id === serviceId && accounts.get(profile.account_id as string)?.status === "active") ?? null);
    if (serviceFilter.startsWith("in.")) {
      const ids = serviceFilter.slice(4, -1).split(",");
      return send(response, 200, [...profiles.values()].filter((profile) => ids.includes(profile.id as string) && accountList.includes(profile.account_id as string)));
    }
    const category = url.searchParams.get("category")?.slice(3);
    return send(response, 200, [...profiles.values()].filter((profile) => accountList.includes(profile.account_id as string) && (!category || profile.category === category)));
  }
  if (url.pathname === "/rest/v1/services" && request.method === "PATCH") {
    const accountId = url.searchParams.get("account_id")?.slice(3) ?? "";
    const profile = profiles.get(accountId);
    if (!profile) return send(response, 404, { message: "profile missing" });
    Object.assign(profile, json());
    return send(response, 204);
  }
  if (url.pathname === "/rest/v1/my_trip_saved_services" && request.method === "GET") {
    const owner = url.searchParams.get("customer_account_id")?.slice(3) ?? "";
    return send(response, 200, [...(savedServices.get(owner) ?? [])].map((service_id) => ({ service_id, created_at: "2026-10-23T00:00:00.000Z" })));
  }
  if (url.pathname === "/rest/v1/package_bookings" && request.method === "GET") return send(response, 200, []);
  if (url.pathname === "/rest/v1/my_trip_booking_services" && request.method === "GET") return send(response, 200, []);
  if (url.pathname === "/rest/v1/my_trip_saved_services" && request.method === "POST") {
    const input = json();
    const rows = savedServices.get(input.customer_account_id as string) ?? new Set<string>();
    rows.add(input.service_id as string); savedServices.set(input.customer_account_id as string, rows);
    return send(response, 201, []);
  }
  if (url.pathname === "/rest/v1/my_trip_saved_services" && request.method === "DELETE") {
    const owner = url.searchParams.get("customer_account_id")?.slice(3) ?? "";
    savedServices.get(owner)?.delete(url.searchParams.get("service_id")?.slice(3) ?? "");
    return send(response, 204);
  }
  if (url.pathname.startsWith("/storage/v1/object/sign/staff-photo-staging/") && request.method === "POST") {
    const path = decodeURIComponent(url.pathname.split("/storage/v1/object/sign/staff-photo-staging/")[1]);
    return send(response, 200, { signedURL: `/object/sign/staff-photo-staging/${path}?token=local-test` });
  }
  if (url.pathname.startsWith("/storage/v1/object/sign/staff-photo-staging/") && request.method === "GET") {
    const path = decodeURIComponent(url.pathname.split("/storage/v1/object/sign/staff-photo-staging/")[1]);
    const bytes = stagedObjects.get(path);
    return bytes ? send(response, 200, bytes, "application/octet-stream") : send(response, 404, { message: "object missing" });
  }
  if (url.pathname.startsWith("/storage/v1/object/upload/sign/staff-photo-staging/") && request.method === "POST") {
    const path = decodeURIComponent(url.pathname.split("/storage/v1/object/upload/sign/staff-photo-staging/")[1]);
    return send(response, 200, { url: `/object/upload/sign/staff-photo-staging/${path}?token=local-test` });
  }
  if (url.pathname.startsWith("/storage/v1/object/upload/sign/staff-photo-staging/") && request.method === "PUT") {
    const path = decodeURIComponent(url.pathname.split("/storage/v1/object/upload/sign/staff-photo-staging/")[1]);
    if (stagedObjects.has(path)) return send(response, 400, { message: "object already exists" });
    stagedObjects.set(path, body);
    return send(response, 200, { Key: path });
  }
  if (url.pathname === "/storage/v1/object/staff-photo-staging" && request.method === "DELETE") {
    for (const path of (json().prefixes as string[] | undefined) ?? []) stagedObjects.delete(path);
    return send(response, 200, { message: "ok" });
  }
  if (url.pathname.startsWith("/storage/v1/object/sign/") && request.method === "POST") {
    const input = json();
    const paths = input.paths as string[];
    const bucket = url.pathname.split("/").at(-1);
    return send(response, 200, paths.map((path) => ({ path, signedURL: `/object/sign/${bucket}/${path}?token=local-test` })));
  }
  if (url.pathname.startsWith("/storage/v1/object/sign/") && request.method === "GET") return send(response, 200, fakeWebp, "image/webp");
  if (url.pathname.startsWith("/storage/v1/object/staff-business-photos/") && request.method === "POST") {
    objects.add(decodeURIComponent(url.pathname.split("/").slice(5).join("/")));
    return send(response, 200, { Key: url.pathname });
  }
  if (url.pathname === "/storage/v1/object/staff-business-photos" && request.method === "DELETE") return send(response, 200, { message: "ok" });

  return send(response, 404, { message: `unhandled ${request.method} ${url.pathname}` });
});

test.beforeAll(async () => {
  fakeWebp = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#7bab52" } }).webp().toBuffer();
  await new Promise<void>((resolve) => fakeSupabase.listen(4174, "127.0.0.1", resolve));
  const tokenHash = createHash("sha256").update("admin-seeded-session").digest("hex");
  sessions.set(tokenHash, admin.id);
  sessions.set(createHash("sha256").update("customer-seeded-session").digest("hex"), customerA.id);
  sessions.set(createHash("sha256").update("customer-b-seeded-session").digest("hex"), customerB.id);
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => fakeSupabase.close((error) => error ? reject(error) : resolve()));
});

test("Staff can register, wait for Admin approval, edit their own profile, and reload the saved result", async ({ page, context }) => {
  const screenshotDir = process.env.UI_SCREENSHOT_DIR ?? process.env.STAFF_APPROVAL_SCREENSHOT_DIR;
  let registrationBodySize = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/staff/register" && request.method() === "POST") registrationBodySize = request.postDataBuffer()?.byteLength ?? 0;
  });
  if (screenshotDir) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/staff/register");
  if (screenshotDir) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-staff-form-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-staff-form-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.getByLabel("ชื่อกิจการ").fill("กลุ่มผ้าทอชุมชน");
  await page.getByLabel("ที่อยู่").fill("บ้านต้นผึ้ง จังหวัดเชียงใหม่");
  await page.getByLabel("ละติจูด").fill("18.8");
  await page.getByLabel("ลองจิจูด").fill("98.9");
  await page.getByLabel("เบอร์โทรศัพท์").fill("0800000000");
  await page.getByLabel("อีเมล").fill("staff@example.test");
  await page.getByLabel(/^รหัสผ่าน/).fill("staff-password-123");
  await page.getByLabel("รูปกิจการ (1–19 รูป)").setInputFiles({ name: "shop.png", mimeType: "image/png", buffer: await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ffffff" } }).png().toBuffer() });
  await page.getByRole("button", { name: "ส่งข้อมูลสมัคร" }).click();
  await expect.poll(() => registrationBodySize).toBeGreaterThan(0);
  expect(registrationBodySize).toBeLessThan(64 * 1024);
  await expect(page.getByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว" })).toBeVisible();
  await expect(page.getByText("กำลังรอผู้ดูแลตรวจสอบ")).toBeVisible();

  await page.goto("/staff");
  await expect(page.getByText("บัญชีนี้ยังไม่มีสิทธิ์ Staff ที่อนุมัติแล้ว กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับอนุมัติ")).toBeVisible();

  await context.addCookies([{ name: "tonphueng_session", value: "admin-seeded-session", url: "http://127.0.0.1:4173" }]);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "กลุ่มผ้าทอชุมชน" })).toBeVisible();
  const applicantPhoto = page.getByAltText("รูปกิจการ 1 ของ กลุ่มผ้าทอชุมชน");
  await expect(applicantPhoto).toBeVisible();
  await expect.poll(() => applicantPhoto.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText("staff@example.test")).toBeVisible();
  if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/tonphueng-admin-approval-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "อนุมัติผู้ประกอบการ" }).click();
  await expect(page.getByText("ไม่มีผู้สมัครที่รออนุมัติ")).toBeVisible();

  await page.goto("/login");
  await page.getByRole("button", { name: "ผู้ประกอบการชุมชน" }).click();
  await page.getByLabel("อีเมล").fill("staff@example.test");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("staff-password-123");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByLabel("ชื่อกิจการ")).toHaveValue("กลุ่มผ้าทอชุมชน");
  await expect(page.getByAltText("รูปกิจการ 1")).toBeVisible();
  if (screenshotDir) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-staff-profile-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-staff-profile-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await page.getByLabel("ชื่อกิจการ").fill("กลุ่มผ้าทอชุมชนรุ่นใหม่");
  const saveResponse = page.waitForResponse((response) => response.url().endsWith("/api/staff/profile"));
  const profileReload = page.waitForResponse((response) => new URL(response.url()).pathname === "/staff" && response.request().method() === "GET");
  await page.getByRole("button", { name: "บันทึกข้อมูลกิจการ" }).click();
  expect((await saveResponse).status()).toBe(200);
  expect((await profileReload).status()).toBe(200);
  await expect(page.getByRole("status")).toContainText("บันทึกข้อมูลกิจการแล้ว");
  await expect(page.getByLabel("ชื่อกิจการ")).toHaveValue("กลุ่มผ้าทอชุมชนรุ่นใหม่");
  await page.reload();
  await expect(page.getByLabel("ชื่อกิจการ")).toHaveValue("กลุ่มผ้าทอชุมชนรุ่นใหม่");

  await page.getByLabel("รายละเอียดกิจการ").fill("ผ้าทอมือจากชุมชนบ้านต้นผึ้ง");
  const descriptionSave = page.waitForResponse((response) => response.url().endsWith("/api/staff/profile"));
  const descriptionReload = page.waitForResponse((response) => new URL(response.url()).pathname === "/staff" && response.request().method() === "GET");
  await page.getByRole("button", { name: "บันทึกข้อมูลกิจการ" }).click();
  expect((await descriptionSave).status()).toBe(200);
  expect((await descriptionReload).status()).toBe(200);
  await expect(page.getByLabel("รายละเอียดกิจการ")).toHaveValue("ผ้าทอมือจากชุมชนบ้านต้นผึ้ง");
  await page.getByLabel("เปลี่ยนรูปกิจการ (ไม่เกิน 19 รูป)").setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ca7b52" } }).png().toBuffer() });
  const photoSave = page.waitForResponse((response) => response.url().endsWith("/api/staff/profile"));
  await page.getByRole("button", { name: "บันทึกข้อมูลกิจการ" }).click();
  expect((await photoSave).status()).toBe(200);
  await expect(page.getByLabel("เปลี่ยนรูปกิจการ (ไม่เกิน 19 รูป)")).toHaveValue("");
  await expect(page.getByAltText("รูปกิจการ 1")).toBeVisible();
  await context.addCookies([{ name: "tonphueng_session", value: "customer-seeded-session", url: "http://127.0.0.1:4173" }]);
  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "กลุ่มผ้าทอชุมชนรุ่นใหม่" })).toBeVisible();
  await page.route("**/api/services?**category=accommodation**", async (route) => {
    await page.waitForTimeout(300);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: [{ id: "88888888-8888-4888-8888-888888888888", name: "ผลลัพธ์เก่าจากตัวกรอง", description: "", address: "", latitude: 0, longitude: 0, phone: "", category: "accommodation", other_category: null, photos: [] }], hasMore: false, limit: 12 }) });
  });
  await page.getByLabel("ประเภทบริการ").selectOption("accommodation");
  await page.getByLabel("ประเภทบริการ").selectOption("tourism_trail");
  await expect(page.getByText("ยังไม่มีบริการในหมวดนี้")).toBeVisible();
  await page.waitForTimeout(350);
  await expect(page.getByText("ผลลัพธ์เก่าจากตัวกรอง")).toHaveCount(0);
  await page.unrouteAll({ behavior: "wait" });
  await page.getByLabel("ประเภทบริการ").selectOption("all");
  await expect(page.getByRole("heading", { name: "กลุ่มผ้าทอชุมชนรุ่นใหม่" })).toBeVisible();
  await page.getByRole("button", { name: "เรียงตามระยะใกล้" }).click();
  await expect(page.getByText(/ไม่ได้รับตำแหน่ง/)).toBeVisible();
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 18.8, longitude: 98.9 });
  await page.getByRole("button", { name: "เรียงตามระยะใกล้" }).click();
  await expect(page.getByText(/เรียงตามระยะเส้นตรง/)).toBeVisible();
  await page.getByRole("link", { name: /กลุ่มผ้าทอชุมชนรุ่นใหม่/ }).click();
  await expect(page.getByText("ผ้าทอมือจากชุมชนบ้านต้นผึ้ง")).toBeVisible();
  await expect(page.getByRole("link", { name: "เปิดพิกัดใน Google Maps" })).toHaveAttribute("href", /google\.com\/maps\/search/);
  await page.getByRole("button", { name: "บันทึกเข้า My Trip" }).click();
  await expect(page.getByRole("status")).toContainText("บันทึกเข้า My Trip แล้ว");
  await page.goto("/my-trip");
  await expect(page.getByRole("region", { name: "สถานที่ที่บันทึกเอง" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "กลุ่มผ้าทอชุมชนรุ่นใหม่" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "กลุ่มผ้าทอชุมชนรุ่นใหม่" })).toBeVisible();
});
