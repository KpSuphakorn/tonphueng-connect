import { createServer, type Server } from "node:http";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

type Account = { id: string; role: string; status: string; line_subject: string | null; auth_user_id: string | null; created_at: string };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const users = new Map<string, { id: string; email: string; password: string }>();
const accounts = new Map<string, Account>();
const sessions = new Map<string, string>();
const services = new Map<string, Record<string, unknown>>();
let supabase: Server;
let ownerAdmin: Account, customer: Account, staff: Account;

function addUser(email: string, password: string) { const user = { id: randomUUID(), email, password }; users.set(user.id, user); return user; }
function addAccount(row: Omit<Account, "id" | "created_at">) { const account = { id: randomUUID(), created_at: new Date().toISOString(), ...row }; accounts.set(account.id, account); return account; }
function seed() {
  users.clear(); accounts.clear(); sessions.clear(); services.clear();
  const owner = addUser("owner@example.test", "owner-password-123");
  ownerAdmin = addAccount({ role: "admin", status: "active", line_subject: "U_owner", auth_user_id: owner.id });
  customer = addAccount({ role: "customer", status: "active", line_subject: "U_customer", auth_user_id: null });
  const staffUser = addUser("staff@example.test", "staff-password-123");
  staff = addAccount({ role: "staff", status: "active", line_subject: null, auth_user_id: staffUser.id });
  services.set(staff.id, { id: randomUUID(), account_id: staff.id, name: "ร้านต้นผึ้ง", description: "", address: "บ้านต้นผึ้ง", latitude: 18.8, longitude: 98.9, phone: "0800000000", category: "community_product", other_category: null, photo_paths: [] });
  for (const [token, account] of [["owner-session", ownerAdmin], ["customer-session", customer], ["staff-session", staff]] as const) sessions.set(hash(token), account.id);
}

async function readBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
function send(response: import("node:http").ServerResponse, status: number, value?: unknown) {
  response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  response.end(value === undefined ? undefined : JSON.stringify(value));
}

/** LIFF stub (same approach as login.spec.ts) so the browser can obtain a LINE ID token without a real LINE call. */
async function stubLine(page: Page) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const content = `${encode({ alg: "ES256", kid: "playwright-key" })}.${encode({ iss: "https://access.line.me", aud: "2012159405", sub: "U_new_admin", exp: Math.floor(Date.now() / 1000) + 600 })}`;
  const idToken = `${content}.${sign("sha256", Buffer.from(content), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  const contextToken = `context.${Buffer.from(JSON.stringify({ liffId: "2012159405-playwright-test", endpointUrl: "http://127.0.0.1:4173/login", scope: "openid", type: "full" })).toString("base64url")}.signature`;
  await page.route("https://**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!url.hostname.endsWith("line.me") && !url.hostname.endsWith("line-scdn.net")) return route.abort();
    if (url.pathname.endsWith("/contextToken")) return route.fulfill({ json: { contextToken } });
    if (url.pathname.endsWith("/oauth2/v2.1/certs")) return route.fulfill({ json: { keys: [{ ...publicKey.export({ format: "jwk" }), kid: "playwright-key", alg: "ES256", use: "sig" }] } });
    if (url.pathname.endsWith("/oauth2/v2.1/token")) return route.fulfill({ json: { access_token: "playwright-access-token", id_token: idToken, expires_in: 3600 } });
    if (url.pathname.endsWith("/liff/v1/authorize")) return route.fulfill({ contentType: "text/html", body: `<script>const u=new URLSearchParams(location.search);const t=new URL(u.get("redirect_uri"));t.searchParams.set("code","playwright-code");t.searchParams.set("liffClientId","2012159405");location.replace(t.href)</script>` });
    if (url.hostname.endsWith("line-scdn.net")) return route.fulfill({ contentType: "application/javascript", body: "" });
    return route.fulfill({ status: 404, json: { error: "unexpected LINE request" } });
  });
  return idToken;
}

test.beforeAll(async () => {
  supabase = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:4174");
    const text = await readBody(request);
    const input = () => (text ? JSON.parse(text) : {}) as Record<string, unknown>;
    const eq = (key: string) => url.searchParams.get(key)?.replace(/^eq\./, "");
    if (request.method === "OPTIONS") { response.writeHead(204, { "access-control-allow-origin": "http://127.0.0.1:4173", "access-control-allow-methods": "GET, POST, PATCH, OPTIONS", "access-control-allow-headers": "authorization, apikey, content-type" }); return response.end(); }
    if (url.pathname === "/auth/v1/token") {
      const { email, password } = input();
      const user = [...users.values()].find((item) => item.email === email && item.password === password);
      return user ? send(response, 200, { access_token: "t", token_type: "bearer", expires_in: 3600, refresh_token: "r", user: { id: user.id, email: user.email } }) : send(response, 400, { error: "invalid_grant" });
    }
    if (url.pathname === "/auth/v1/admin/users" && request.method === "GET") return send(response, 200, { users: [...users.values()].map(({ id, email }) => ({ id, email })) });
    if (url.pathname === "/auth/v1/admin/users" && request.method === "POST") {
      const { email, password } = input();
      if ([...users.values()].some((user) => user.email === email)) return send(response, 422, { code: "email_exists", msg: "already registered" });
      const user = addUser(String(email), String(password));
      return send(response, 200, { id: user.id, email: user.email });
    }
    if (url.pathname.startsWith("/auth/v1/admin/users/") && request.method === "GET") {
      const user = users.get(url.pathname.split("/").at(-1)!);
      return send(response, user ? 200 : 404, user ? { id: user.id, email: user.email } : { msg: "missing" });
    }
    if (url.pathname === "/rest/v1/app_sessions" && request.method === "GET") {
      const account = accounts.get(sessions.get(eq("token_hash") ?? "") ?? "");
      return send(response, 200, account ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: account } : null);
    }
    if (url.pathname === "/rest/v1/app_sessions" && request.method === "POST") { const row = input(); sessions.set(String(row.token_hash), String(row.account_id)); return send(response, 201); }
    if (url.pathname === "/rest/v1/app_accounts" && request.method === "GET") {
      if ((url.searchParams.get("select") ?? "").includes("services!")) return send(response, 200, []);
      const rows = [...accounts.values()].filter((row) => ["id", "role", "auth_user_id", "status"].every((key) => !url.searchParams.has(key) || String(row[key as keyof Account]) === eq(key)));
      return send(response, 200, url.searchParams.has("auth_user_id") ? rows[0] ?? null : rows);
    }
    if (url.pathname === "/rest/v1/app_accounts" && request.method === "POST") {
      const row = input() as Omit<Account, "id" | "created_at">;
      if ([...accounts.values()].some((item) => item.role === row.role && item.auth_user_id === row.auth_user_id)) return send(response, 409, { code: "23505", message: "duplicate key" });
      return send(response, 201, addAccount(row));
    }
    if (url.pathname === "/rest/v1/services" && request.method === "GET") return send(response, 200, services.get(eq("account_id") ?? "") ?? null);
    return send(response, 404, { message: `Unhandled ${request.method} ${url.pathname}` });
  });
  await new Promise<void>((resolve) => supabase.listen(4174, "127.0.0.1", resolve));
});
test.afterAll(async () => { await new Promise<void>((resolve, reject) => supabase.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(async ({ page }) => { seed(); await page.setViewportSize({ width: 390, height: 844 }); });

async function signIn(page: Page, token: string) {
  await page.context().addCookies([{ name: "tonphueng_session", value: token, url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Lax" }]);
}
async function addAdminCall(page: Page) {
  return page.evaluate(async () => (await fetch("/api/admin/admins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "intruder@example.test", password: "intruder-password" }) })).status);
}

test("active Admin adds Admins; existing accounts keep their password; others cannot add or self-assign", async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
  await signIn(page, "owner-session");
  await page.goto("/admin");
  await page.getByRole("link", { name: "จัดการผู้ดูแล" }).click();
  await expect(page.getByRole("heading", { name: "จัดการผู้ดูแล" })).toBeVisible();
  await page.getByLabel("อีเมลผู้ดูแลใหม่").fill("new@example.test");
  await page.getByLabel("รหัสผ่านเริ่มต้น").fill("initial-password");
  await page.getByRole("button", { name: "เพิ่มผู้ดูแล" }).click();
  await expect(page.getByText(/เพิ่มผู้ดูแลแล้ว/)).toBeVisible();
  await expect(page.getByText("new@example.test")).toBeVisible();
  await expect(page.getByText("รอยืนยันรับสิทธิ์และผูก LINE")).toBeVisible();
  const invitee = [...users.values()].find((user) => user.email === "new@example.test")!;
  expect([...accounts.values()].find((row) => row.auth_user_id === invitee.id)).toMatchObject({ role: "admin", status: "pending", line_subject: null });

  await page.getByLabel("อีเมลผู้ดูแลใหม่").fill("staff@example.test");
  await page.getByLabel("รหัสผ่านเริ่มต้น").fill("ignored-password-1");
  await page.getByRole("button", { name: "เพิ่มผู้ดูแล" }).click();
  await expect(page.getByText(/บัญชีนี้มีอยู่แล้ว ผู้รับใช้รหัสผ่านเดิมเข้าสู่ระบบ/)).toBeVisible();
  expect([...users.values()].find((user) => user.email === "staff@example.test")?.password).toBe("staff-password-123");
  await page.getByLabel("อีเมลผู้ดูแลใหม่").fill("staff@example.test");
  await page.getByLabel("รหัสผ่านเริ่มต้น").fill("ignored-password-1");
  await page.getByRole("button", { name: "เพิ่มผู้ดูแล" }).click();
  await expect(page.getByText("อีเมลนี้เป็นผู้ดูแลหรือได้รับเชิญเป็นผู้ดูแลอยู่แล้ว")).toBeVisible();
  if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/tonphueng-admin-admins-mobile.png`, fullPage: true });

  const pendingRow = [...accounts.values()].find((row) => row.auth_user_id === invitee.id)!;
  sessions.set(hash("pending-admin-session"), pendingRow.id);
  for (const token of ["customer-session", "staff-session", "pending-admin-session"]) {
    await signIn(page, token);
    await page.goto("/admin/admins");
    await expect(page.getByText("กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ใช้งานได้")).toBeVisible();
    expect(await addAdminCall(page)).toBe(403);
  }
  await page.goto("/admin");
  await expect(page.getByText("กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่เจ้าของโครงการตั้งค่าไว้")).toBeVisible();
  expect([...users.values()].some((user) => user.email === "intruder@example.test")).toBe(false);

  // Same email, Staff role chosen: the real password route uses the Staff row and lands in the Staff area.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByRole("button", { name: "ผู้ประกอบการชุมชน" }).click();
  await page.getByLabel("อีเมล").fill("staff@example.test");
  await page.getByLabel("รหัสผ่าน").fill("staff-password-123");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole("heading", { name: "ข้อมูลกิจการของฉัน" })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByText("กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่เจ้าของโครงการตั้งค่าไว้")).toBeVisible();
});

test("a pending Admin sees an explicit acceptance step and resubmits with the acceptance flag and LINE token", async ({ page }) => {
  const idToken = await stubLine(page);
  const posted: Array<Record<string, unknown>> = [];
  // Server-side LINE verification cannot run here without calling LINE; the route's binding rules are covered in tests/admin-invitation.test.ts.
  await page.route("**/api/auth/password", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    posted.push(body);
    if (body.acceptAdminRole !== true) return route.fulfill({ status: 409, json: { code: "admin_acceptance_required", error: "กรุณายืนยันรับสิทธิ์ผู้ดูแลโครงการ" } });
    return route.fulfill({ json: { role: "admin", redirectTo: "/login?accepted=1" } });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "ผู้ดูแลโครงการ" }).click();
  await page.getByRole("button", { name: "ยืนยันบัญชี LINE ที่ผูกไว้" }).click();
  await page.waitForURL(/code=playwright-code|\/login/);
  await page.getByRole("button", { name: "ผู้ดูแลโครงการ" }).click();
  await page.getByRole("button", { name: "ยืนยันบัญชี LINE ที่ผูกไว้" }).click();
  await expect(page.getByRole("button", { name: "ยืนยัน LINE แล้ว" })).toBeVisible();
  await page.getByLabel("อีเมล").fill("new@example.test");
  await page.getByLabel("รหัสผ่าน").fill("initial-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.getByText("ยืนยันรับสิทธิ์ผู้ดูแล", { exact: true })).toBeVisible();
  const accept = page.getByRole("button", { name: "ยืนยันรับสิทธิ์และเข้าสู่ระบบ" });
  await expect(accept).toBeDisabled();
  if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/tonphueng-admin-accept-mobile.png`, fullPage: true });
  await page.getByRole("checkbox", { name: /ยืนยันรับสิทธิ์ผู้ดูแลโครงการและผูกบัญชี LINE นี้/ }).check();
  await accept.click();
  await expect(page).toHaveURL(/accepted=1/);
  expect(posted).toHaveLength(2);
  expect(posted[0]).toMatchObject({ role: "admin", email: "new@example.test", lineIdToken: idToken });
  expect(posted[0]).not.toHaveProperty("acceptAdminRole");
  expect(posted[1]).toMatchObject({ role: "admin", lineIdToken: idToken, acceptAdminRole: true });
});
