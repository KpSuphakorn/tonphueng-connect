import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { expect, test } from "@playwright/test";

const admin = { id: "11111111-1111-4111-8111-111111111111", role: "admin", status: "active", line_subject: "U_admin", auth_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", created_at: "2026-01-01T00:00:00.000Z" };
const accounts = new Map<string, Record<string, unknown>>([[admin.id, admin]]);
const users = new Map<string, { id: string; email: string; password: string }>([[admin.auth_user_id, { id: admin.auth_user_id, email: "owner@example.test", password: "admin-password" }]]);
const sessions = new Map<string, string>();
const profiles = new Map<string, Record<string, unknown>>();
const objects = new Set<string>();
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
      const pending = [...accounts.values()].filter((account) => account.role === "staff" && account.status === "pending").map((account) => ({
        id: account.id,
        auth_user_id: account.auth_user_id,
        services: [...profiles.values()].filter((profile) => profile.account_id === account.id),
      }));
      return send(response, 200, pending);
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
  if (url.pathname === "/rest/v1/services" && request.method === "POST") {
    const input = json();
    const profile: Record<string, unknown> = { id: randomUUID(), ...input };
    profiles.set(profile.account_id as string, profile);
    return send(response, 201, profile);
  }
  if (url.pathname === "/rest/v1/services" && request.method === "GET") {
    const accountId = url.searchParams.get("account_id")?.slice(3) ?? "";
    return send(response, 200, profiles.get(accountId) ?? null);
  }
  if (url.pathname === "/rest/v1/services" && request.method === "PATCH") {
    const accountId = url.searchParams.get("account_id")?.slice(3) ?? "";
    const profile = profiles.get(accountId);
    if (!profile) return send(response, 404, { message: "profile missing" });
    Object.assign(profile, json());
    return send(response, 204);
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
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => fakeSupabase.close((error) => error ? reject(error) : resolve()));
});

test("Staff can register, wait for Admin approval, edit their own profile, and reload the saved result", async ({ page, context }) => {
  const screenshotDir = process.env.STAFF_APPROVAL_SCREENSHOT_DIR;
  if (screenshotDir) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/staff/register");
  if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/tonphueng-staff-register-mobile.png`, fullPage: true });
  await page.getByLabel("ชื่อกิจการ").fill("กลุ่มผ้าทอชุมชน");
  await page.getByLabel("ที่อยู่").fill("บ้านต้นผึ้ง จังหวัดเชียงใหม่");
  await page.getByLabel("ละติจูด").fill("18.8");
  await page.getByLabel("ลองจิจูด").fill("98.9");
  await page.getByLabel("เบอร์โทรศัพท์").fill("0800000000");
  await page.getByLabel("อีเมล").fill("staff@example.test");
  await page.getByLabel("รหัสผ่าน").fill("staff-password-123");
  await page.getByLabel("รูปกิจการ (1–19 รูป)").setInputFiles({ name: "shop.png", mimeType: "image/png", buffer: await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ffffff" } }).png().toBuffer() });
  await page.getByRole("button", { name: "ส่งข้อมูลสมัคร" }).click();
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
  await page.getByLabel("รหัสผ่าน").fill("staff-password-123");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByLabel("ชื่อกิจการ")).toHaveValue("กลุ่มผ้าทอชุมชน");
  await expect(page.getByAltText("รูปกิจการ 1")).toBeVisible();

  await page.getByLabel("ชื่อกิจการ").fill("กลุ่มผ้าทอชุมชนรุ่นใหม่");
  const saveResponse = page.waitForResponse((response) => response.url().endsWith("/api/staff/profile"));
  const profileReload = page.waitForResponse((response) => new URL(response.url()).pathname === "/staff" && response.request().method() === "GET");
  await page.getByRole("button", { name: "บันทึกข้อมูลกิจการ" }).click();
  expect((await saveResponse).status()).toBe(200);
  expect((await profileReload).status()).toBe(200);
  await expect(page.getByLabel("ชื่อกิจการ")).toHaveValue("กลุ่มผ้าทอชุมชนรุ่นใหม่");
  await page.reload();
  await expect(page.getByLabel("ชื่อกิจการ")).toHaveValue("กลุ่มผ้าทอชุมชนรุ่นใหม่");
});
