import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { POST as register } from "../src/app/api/staff/register/route";
import { POST as updateProfile } from "../src/app/api/staff/profile/route";
import { POST as approve } from "../src/app/api/admin/staff/[accountId]/approve/route";

const adminAccount = { id: "11111111-1111-4111-8111-111111111111", role: "admin", status: "active", line_subject: "U_admin", auth_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const staffAccount = { id: "22222222-2222-4222-8222-222222222222", role: "staff", status: "active", line_subject: null, auth_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
const service = {
  id: "33333333-3333-4333-8333-333333333333",
  account_id: staffAccount.id,
  name: "บ้านตัวอย่าง",
  address: "บ้านต้นผึ้ง",
  latitude: 18.8,
  longitude: 98.9,
  phone: "0800000000",
  category: "community_product",
  other_category: null,
  photo_paths: ["staff-account-22222222/old.webp"],
};

function jsonRequest(url: string, body: unknown, token: string, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie: `tonphueng_session=${token}` },
    body: JSON.stringify(body),
  });
}

function multipartRequest(url: string, form: FormData, token?: string) {
  const photos = form.getAll("photos").filter((entry): entry is File => entry instanceof File);
  if (photos.length) {
    stagedPhotoFiles = photos;
    form.delete("photos");
    form.set("upload_session", "unit-test-session-token-12345678901234567890");
  } else stagedPhotoFiles = [];
  const headers = new Headers({ origin: "http://localhost:3000" });
  if (token) headers.set("cookie", `tonphueng_session=${token}`);
  return new Request(`http://localhost:3000${url}`, { method: "POST", headers, body: form });
}

let stagedPhotoFiles: File[] = [];
let claimedPhotoSessions = new Set<string>();

function registrationForm({ photo }: { photo?: File } = {}) {
  const form = new FormData();
  form.set("name", "บ้านตัวอย่าง");
  form.set("address", "บ้านต้นผึ้ง");
  form.set("latitude", "18.8");
  form.set("longitude", "98.9");
  form.set("phone", "0800000000");
  form.set("category", "community_product");
  form.set("email", "staff@example.test");
  form.set("password", "a-private-password");
  if (photo) form.append("photos", photo);
  return form;
}

function installBoundary(options: {
  pendingStaff?: boolean;
  storageRemoveFails?: boolean;
  authDeleteFails?: boolean;
  failSecondUpload?: boolean;
  failFirstUpload?: boolean;
  patchGateway502AfterCommit?: boolean;
  serviceInsertGateway502AfterCommit?: boolean;
  persistedPhotoPaths?: string[];
  existingAuthPassword?: string;
  staffRowExists?: boolean;
} = {}) {
  vi.stubEnv("SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  const calls: Array<{ url: URL; method: string; body: string; headers: Headers }> = [];
  claimedPhotoSessions = new Set();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : "";
    const headers = new Headers(init?.headers);
    calls.push({ url, method, body, headers });

    if (url.pathname === "/auth/v1/admin/users" && method === "POST" && options.existingAuthPassword) {
      return Response.json({ code: "email_exists", msg: "A user with this email address has already been registered" }, { status: 422 });
    }
    if (url.pathname === "/auth/v1/token" && method === "POST") {
      const input = JSON.parse(body) as { email: string; password: string };
      if (!options.existingAuthPassword || input.email !== "staff@example.test" || input.password !== options.existingAuthPassword) return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json({ access_token: "t", token_type: "bearer", expires_in: 3600, refresh_token: "r", user: { id: "66666666-6666-4666-8666-666666666666", email: "staff@example.test" } });
    }
    if (url.pathname === "/rest/v1/app_accounts" && method === "DELETE") return new Response(null, { status: 204 });
    if (url.pathname === "/auth/v1/admin/users" && method === "POST") {
    return Response.json({ id: "44444444-4444-4444-8444-444444444444", email: "staff@example.test" }, { status: 200 });
    }
    if (url.pathname === "/auth/v1/admin/users/44444444-4444-4444-8444-444444444444" && method === "DELETE") {
      if (options.authDeleteFails) return Response.json({ message: "delete failed" }, { status: 400 });
      return Response.json({ id: "44444444-4444-4444-8444-444444444444" });
    }
    if (url.pathname === "/rest/v1/app_accounts" && method === "POST") {
      if (options.staffRowExists) return Response.json({ code: "23505", message: "duplicate key app_accounts_role_auth_user_id_key" }, { status: 409 });
      return Response.json({ id: "55555555-5555-4555-8555-555555555555" }, { status: 201 });
    }
    if (url.pathname === "/rest/v1/app_sessions" && method === "GET") {
      const staffHash = createHash("sha256").update("staff-session").digest("hex");
      const account = url.searchParams.get("token_hash") === `eq.${staffHash}`
        ? { ...staffAccount, status: options.pendingStaff ? "pending" : "active" }
        : adminAccount;
      return Response.json({ expires_at: "2999-01-01T00:00:00.000Z", app_accounts: account });
    }
    if (url.pathname === "/rest/v1/rpc/approve_staff_account") return Response.json([{ id: staffAccount.id, role: "staff", status: "active" }]);
    if (url.pathname === "/rest/v1/rpc/claim_staff_photo_upload_session") {
      const input = JSON.parse(body) as { target_token_hash: string; target_flow: string; target_account_id: string | null };
      const expectedHash = createHash("sha256").update("unit-test-session-token-12345678901234567890").digest("hex");
      if (input.target_token_hash !== expectedHash || claimedPhotoSessions.has(input.target_token_hash) ||
        (input.target_flow === "registration" ? input.target_account_id !== null : input.target_flow !== "profile" || input.target_account_id !== staffAccount.id)) return Response.json([]);
      claimedPhotoSessions.add(input.target_token_hash);
      const paths = stagedPhotoFiles.map((_, index) => `99999999-9999-4999-8999-999999999999/${index + 1}-photo.upload`);
      return Response.json(paths.length ? [{ id: "99999999-9999-4999-8999-999999999999", staging_paths: paths, expires_at: "2999-01-01T00:00:00.000Z" }] : []);
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/staff-photo-staging/") && method === "POST") {
      return Response.json({ signedURL: `${url.pathname.replace("/storage/v1", "")}?token=local-stage-token` });
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/staff-photo-staging/") && method === "GET") {
      const index = Number(url.pathname.split("/").at(-1)?.split("-")[0]) - 1;
      const file = stagedPhotoFiles[index];
      return file ? new Response(await file.arrayBuffer()) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && method === "PATCH") return new Response(null, { status: 204 });
    if (url.pathname === "/rest/v1/services" && method === "POST") {
      if (options.serviceInsertGateway502AfterCommit) {
        const inserted = JSON.parse(body) as { photo_paths: string[] };
        options.persistedPhotoPaths?.splice(0, options.persistedPhotoPaths.length, ...inserted.photo_paths);
        return Response.json({ message: "gateway lost the response after commit" }, { status: 502 });
      }
      return new Response(null, { status: 201 });
    }
    if (url.pathname.startsWith("/storage/v1/object/staff-business-photos/") && method === "POST") {
      if (options.failFirstUpload && calls.filter((call) => call.url.pathname.startsWith("/storage/v1/object/staff-business-photos/") && call.method === "POST").length === 1) {
        return Response.json({ message: "upload failed" }, { status: 400 });
      }
      if (options.failSecondUpload && calls.filter((call) => call.url.pathname.startsWith("/storage/v1/object/staff-business-photos/") && call.method === "POST").length === 2) {
        return Response.json({ message: "upload failed" }, { status: 400 });
      }
      return Response.json({ Key: url.pathname });
    }
    if ((url.pathname.startsWith("/storage/v1/object/staff-business-photos/") || url.pathname === "/storage/v1/object/staff-business-photos") && method === "DELETE") {
      if (options.storageRemoveFails) return Response.json({ message: "remove failed" }, { status: 400 });
      return Response.json({ message: "ok" });
    }
    if (url.pathname === "/rest/v1/services" && method === "GET") {
      const ownerId = url.searchParams.get("account_id")?.replace("eq.", "");
      if (ownerId !== staffAccount.id) return Response.json([]);
      return Response.json({ ...service, photo_paths: options.persistedPhotoPaths ?? service.photo_paths });
    }
    if (url.pathname === "/rest/v1/services" && method === "PATCH") {
      if (options.patchGateway502AfterCommit) {
        const updated = JSON.parse(body) as { photo_paths?: string[] };
        if (updated.photo_paths) options.persistedPhotoPaths?.splice(0, options.persistedPhotoPaths.length, ...updated.photo_paths);
        return Response.json({ message: "gateway lost the response after commit" }, { status: 502 });
      }
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected external request: ${method} ${url.pathname}`);
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Staff registration and approval HTTP behavior", () => {
  it("creates a pending Staff account and a private Service profile without trusting submitted roles", async () => {
    const calls = installBoundary();
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    const form = registrationForm({ photo: new File([png], "shop.png", { type: "image/png" }) });
    form.set("role", "admin");
    form.set("status", "active");
    form.set("account_id", adminAccount.id);

    const response = await register(multipartRequest("/api/staff/register", form));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ status: "pending" });
    const accountInsert = calls.find((call) => call.url.pathname === "/rest/v1/app_accounts" && call.method === "POST");
    expect(JSON.parse(accountInsert!.body)).toEqual({ role: "staff", status: "pending", auth_user_id: "44444444-4444-4444-8444-444444444444" });
    const serviceInsert = calls.find((call) => call.url.pathname === "/rest/v1/services" && call.method === "POST");
    expect(JSON.parse(serviceInsert!.body)).toMatchObject({ account_id: "55555555-5555-4555-8555-555555555555", name: "บ้านตัวอย่าง", category: "community_product" });
    expect(serviceInsert!.body).not.toContain(adminAccount.id);
    expect(serviceInsert!.body).not.toContain("a-private-password");
    expect(calls.some((call) => call.url.pathname === "/auth/v1/admin/users" && call.method === "POST" && call.body.includes("a-private-password"))).toBe(true);
  });

  it("rejects a registration capability after its first atomic claim", async () => {
    installBoundary();
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    const form = () => registrationForm({ photo: new File([png], "shop.png", { type: "image/png" }) });
    expect((await register(multipartRequest("/api/staff/register", form()))).status).toBe(201);
    const replay = await register(multipartRequest("/api/staff/register", form()));
    expect(replay.status).toBe(400);
    expect((await replay.json()).error).toContain("ถูกใช้แล้ว");
  });

  it("rejects 20 photos, incomplete data, and bytes that are not a decodable supported image before creating an account", async () => {
    const calls = installBoundary();
    const tooMany = registrationForm();
    const validPng = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    for (let index = 0; index < 20; index++) tooMany.append("photos", new File([validPng], `photo-${index}.png`, { type: "image/png" }));
    expect((await register(multipartRequest("/api/staff/register", tooMany))).status).toBe(400);

    const incomplete = registrationForm();
    incomplete.delete("address");
    expect((await register(multipartRequest("/api/staff/register", incomplete))).status).toBe(400);
    const missingLatitude = registrationForm();
    missingLatitude.delete("latitude");
    expect((await register(multipartRequest("/api/staff/register", missingLatitude))).status).toBe(400);

    const invalidImage = registrationForm({ photo: new File(["plain text"], "fake.png", { type: "image/png" }) });
    expect((await register(multipartRequest("/api/staff/register", invalidImage))).status).toBe(400);

    const noPhoto = registrationForm();
    expect((await register(multipartRequest("/api/staff/register", noPhoto))).status).toBe(400);
    const emptyNamedPhoto = registrationForm({ photo: new File([], "empty.png", { type: "image/png" }) });
    expect((await register(multipartRequest("/api/staff/register", emptyNamedPhoto))).status).toBe(400);
    expect(calls.some((call) => call.url.pathname.startsWith("/auth/v1/admin/users"))).toBe(false);
  });

  it("caps actual multipart bytes even when Content-Length is omitted or understated", async () => {
    const calls = installBoundary();
    const tooLarge = (url: string, headers: HeadersInit) => new Request(url, {
      method: "POST",
      headers,
      body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(27 * 1024 * 1024 + 1)); controller.close(); } }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    expect((await register(tooLarge("http://localhost:3000/api/staff/register", { origin: "http://localhost:3000", "content-type": "multipart/form-data; boundary=unused", "content-length": "1" }))).status).toBe(413);
    const profileRequest = tooLarge("http://localhost:3000/api/staff/profile", { origin: "http://localhost:3000", "content-type": "multipart/form-data; boundary=unused" });
    expect((await updateProfile(profileRequest)).status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it("cleans up the new Auth identity and attempted photo paths when upload fails before the Service write", async () => {
    const calls = installBoundary({ failFirstUpload: true });
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    const response = await register(multipartRequest("/api/staff/register", registrationForm({ photo: new File([png], "shop.png", { type: "image/png" }) })));

    expect(response.status).toBe(503);
    expect(calls.some((call) => call.url.pathname === "/auth/v1/admin/users/44444444-4444-4444-8444-444444444444" && call.method === "DELETE")).toBe(true);
    expect(calls.some((call) => call.url.pathname === "/storage/v1/object/staff-business-photos" && call.method === "DELETE")).toBe(true);
    expect(calls.some((call) => call.url.pathname === "/rest/v1/services" && call.method === "POST")).toBe(false);
  });

  it("returns a recovery reference and safe cleanup details when Storage compensation returns an error", async () => {
    installBoundary({ failFirstUpload: true, storageRemoveFails: true, authDeleteFails: true });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    const response = await register(multipartRequest("/api/staff/register", registrationForm({ photo: new File([png], "shop.png", { type: "image/png" }) })));
    const result = await response.json();

    expect(response.status).toBe(503);
    expect(result).toMatchObject({ cleanup_required: true, reference: "55555555-5555-4555-8555-555555555555" });
    expect(log).toHaveBeenCalledWith("Staff registration cleanup required", expect.objectContaining({
      reference: "55555555-5555-4555-8555-555555555555",
      failures: ["storage_cleanup_failed", "auth_user_cleanup_failed"],
      photoPaths: [expect.stringMatching(/^55555555-5555-4555-8555-555555555555\//)],
    }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("a-private-password");
  });

  it("tracks partial uploads and keeps trying Auth cleanup after an Auth deletion error", async () => {
    const calls = installBoundary({ failSecondUpload: true, authDeleteFails: true });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    const form = registrationForm();
    form.append("photos", new File([png], "first.png", { type: "image/png" }));
    form.append("photos", new File([png], "second.png", { type: "image/png" }));
    const response = await register(multipartRequest("/api/staff/register", form));
    const result = await response.json();

    expect(response.status).toBe(503);
    expect(result).toMatchObject({ cleanup_required: true });
    expect(calls.some((call) => call.url.pathname === "/storage/v1/object/staff-business-photos" && call.method === "DELETE")).toBe(true);
    const cleanupRequest = calls.find((call) => call.url.pathname === "/storage/v1/object/staff-business-photos" && call.method === "DELETE");
    expect(JSON.parse(cleanupRequest!.body).prefixes).toHaveLength(2);
    expect(calls.some((call) => call.url.pathname.endsWith("/44444444-4444-4444-8444-444444444444") && call.method === "DELETE")).toBe(true);
    expect(log).toHaveBeenCalledWith("Staff registration cleanup required", expect.objectContaining({ failures: ["auth_user_cleanup_failed"] }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("a-private-password");
  });

  it("approves only through an active Admin session and an atomic status transition", async () => {
    const calls = installBoundary();
    const request = jsonRequest(`/api/admin/staff/${staffAccount.id}/approve`, { role: "staff", status: "active" }, "admin-session");
    const response = await approve(request, { params: Promise.resolve({ accountId: staffAccount.id }) });

    expect(response.status).toBe(200);
    const approval = calls.find((call) => call.url.pathname === "/rest/v1/rpc/approve_staff_account");
    expect(JSON.parse(approval!.body)).toEqual({ target_account_id: staffAccount.id });
    expect((await approve(jsonRequest(`/api/admin/staff/${staffAccount.id}/approve`, {}, "", "http://attacker.test"), { params: Promise.resolve({ accountId: staffAccount.id }) })).status).toBe(403);
  });

  it("requires an active Staff session and constrains profile reads and writes to that account", async () => {
    const calls = installBoundary();
    const anonymous = await updateProfile(multipartRequest("/api/staff/profile", registrationForm()));
    expect(anonymous.status).toBe(403);

    const form = registrationForm();
    form.set("account_id", "another-staff-account");
    const response = await updateProfile(multipartRequest("/api/staff/profile", form, "staff-session"));
    expect(response.status).toBe(200);
    const read = calls.find((call) => call.url.pathname === "/rest/v1/services" && call.method === "GET");
    const write = calls.find((call) => call.url.pathname === "/rest/v1/services" && call.method === "PATCH");
    expect(read?.url.searchParams.get("account_id")).toBe(`eq.${staffAccount.id}`);
    expect(write?.url.searchParams.get("account_id")).toBe(`eq.${staffAccount.id}`);
    expect(write?.body).not.toContain("another-staff-account");
  });

  it("preserves uploaded profile images when a 502 follows the profile PATCH commit", async () => {
    const persistedPhotoPaths: string[] = [];
    const calls = installBoundary({ patchGateway502AfterCommit: true, persistedPhotoPaths });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    const form = registrationForm({ photo: new File([png], "replacement.png", { type: "image/png" }) });
    const response = await updateProfile(multipartRequest("/api/staff/profile", form, "staff-session"));
    const result = await response.json();

    expect(response.status).toBe(503);
    expect(result).toMatchObject({ verify_required: true, reference: staffAccount.id });
    expect(result.error).toContain("โหลดหน้าเพื่อตรวจสอบก่อนบันทึกซ้ำ");
    expect(calls.some((call) => call.url.pathname === "/storage/v1/object/staff-business-photos" && call.method === "DELETE")).toBe(false);
    expect(persistedPhotoPaths).toEqual(JSON.parse(calls.find((call) => call.url.pathname === "/rest/v1/services" && call.method === "PATCH")!.body).photo_paths);
    expect(persistedPhotoPaths).toHaveLength(1);
    expect(log).toHaveBeenCalledWith("Staff profile write outcome uncertain", expect.objectContaining({
      reference: staffAccount.id,
      photoPaths: [expect.stringMatching(/^22222222-2222-4222-8222-222222222222\//)],
    }));
  });

  it("keeps Auth, account, and photos when a 502 follows the registration Service commit", async () => {
    const persistedPhotoPaths: string[] = [];
    const calls = installBoundary({ serviceInsertGateway502AfterCommit: true, persistedPhotoPaths });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    const response = await register(multipartRequest("/api/staff/register", registrationForm({ photo: new File([png], "shop.png", { type: "image/png" }) })));
    const result = await response.json();

    expect(response.status).toBe(503);
    expect(result).toMatchObject({ verify_required: true, reference: "55555555-5555-4555-8555-555555555555" });
    expect(result.error).toContain("อย่าสมัครซ้ำก่อนตรวจสอบ");
    expect(persistedPhotoPaths).toHaveLength(1);
    expect(calls.some((call) => call.url.pathname.startsWith("/auth/v1/admin/users/") && call.method === "DELETE")).toBe(false);
    expect(calls.some((call) => call.url.pathname === "/storage/v1/object/staff-business-photos" && call.method === "DELETE")).toBe(false);
    expect(log).toHaveBeenCalledWith("Staff registration outcome uncertain", expect.objectContaining({
      reference: "55555555-5555-4555-8555-555555555555",
      photoPaths: persistedPhotoPaths,
    }));
  });

  it("adds a Staff role to an existing Auth user only with its current password and never changes that password", async () => {
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    const form = (password = "a-private-password") => { const value = registrationForm({ photo: new File([png], "shop.png", { type: "image/png" }) }); value.set("password", password); return value; };

    let calls = installBoundary({ existingAuthPassword: "existing-admin-password" });
    const wrong = await register(multipartRequest("/api/staff/register", form("wrong-password")));
    expect(wrong.status).toBe(409);
    const wrongBody = await wrong.json();
    expect(wrongBody.error).toContain("รหัสผ่านปัจจุบัน");
    expect(JSON.stringify(wrongBody)).not.toMatch(/admin|ผู้ดูแล/i);
    expect(calls.some((call) => call.url.pathname === "/rest/v1/app_accounts" && call.method === "POST")).toBe(false);
    vi.unstubAllGlobals();

    calls = installBoundary({ existingAuthPassword: "existing-admin-password" });
    const right = await register(multipartRequest("/api/staff/register", form("existing-admin-password")));
    expect(right.status).toBe(201);
    const accountInsert = calls.find((call) => call.url.pathname === "/rest/v1/app_accounts" && call.method === "POST");
    expect(JSON.parse(accountInsert!.body)).toEqual({ role: "staff", status: "pending", auth_user_id: "66666666-6666-4666-8666-666666666666" });
    expect(calls.some((call) => call.url.pathname.startsWith("/auth/v1/admin/users/") || call.url.pathname === "/auth/v1/user")).toBe(false);
    vi.unstubAllGlobals();

    calls = installBoundary({ existingAuthPassword: "existing-admin-password", staffRowExists: true });
    const duplicate = await register(multipartRequest("/api/staff/register", form("existing-admin-password")));
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toContain("สมัครเป็นผู้ประกอบการไว้แล้ว");
    vi.unstubAllGlobals();

    calls = installBoundary({ existingAuthPassword: "existing-admin-password", failFirstUpload: true });
    const failed = await register(multipartRequest("/api/staff/register", form("existing-admin-password")));
    expect(failed.status).toBe(503);
    const accountDelete = calls.find((call) => call.url.pathname === "/rest/v1/app_accounts" && call.method === "DELETE");
    expect(accountDelete?.url.searchParams.get("id")).toBe("eq.55555555-5555-4555-8555-555555555555");
    expect(accountDelete?.url.searchParams.get("role")).toBe("eq.staff");
    expect(calls.some((call) => call.url.pathname.startsWith("/auth/v1/admin/users/") && call.method === "DELETE")).toBe(false);
  });

  it("does not let a pending Staff session reach the profile endpoint", async () => {
    installBoundary({ pendingStaff: true });
    const response = await updateProfile(multipartRequest("/api/staff/profile", registrationForm(), "staff-session"));
    expect(response.status).toBe(403);
  });
});
