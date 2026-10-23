import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { GET as listAdminsRoute, POST as addAdmin } from "../src/app/api/admin/admins/route";
import { GET as adminPackages } from "../src/app/api/admin/packages/route";
import { POST as approveStaff } from "../src/app/api/admin/staff/[accountId]/approve/route";
import { POST as passwordLogin } from "../src/app/api/auth/password/route";
import { parseAdminInvite } from "../src/lib/admin-invitations";

type Account = { id: string; role: string; status: string; line_subject: string | null; auth_user_id: string | null; created_at: string };
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const lineSubjects: Record<string, string> = { "line.new.token": "U_new_admin", "line.other.token": "U_someone_else", "line.owner.token": "U_owner" };

/** Stateful double of Supabase Auth/PostgREST (migration 009 uniqueness) and LINE token verification. */
function installFake(options: { failAdminInsert?: boolean } = {}) {
  vi.stubEnv("SUPABASE_URL", "http://supabase.test"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key"); vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "2012159405");
  const users = new Map<string, { id: string; email: string; password: string }>();
  const accounts = new Map<string, Account>();
  const sessions = new Map<string, string>();
  const calls: Array<{ method: string; path: string; body: string }> = [];
  const addUser = (email: string, password: string) => { const user = { id: randomUUID(), email, password }; users.set(user.id, user); return user; };
  const addAccount = (row: Omit<Account, "id" | "created_at">) => { const account = { id: randomUUID(), created_at: new Date().toISOString(), ...row }; accounts.set(account.id, account); return account; };
  const owner = addUser("owner@example.test", "owner-password-123");
  const ownerAdmin = addAccount({ role: "admin", status: "active", line_subject: "U_owner", auth_user_id: owner.id });
  const customer = addAccount({ role: "customer", status: "active", line_subject: "U_customer", auth_user_id: null });
  const staffUser = addUser("staff@example.test", "staff-password-123");
  const staff = addAccount({ role: "staff", status: "active", line_subject: null, auth_user_id: staffUser.id });
  const pendingUser = addUser("pending@example.test", "pending-password-123");
  const pendingAdmin = addAccount({ role: "admin", status: "pending", line_subject: null, auth_user_id: pendingUser.id });
  for (const [token, account] of [["owner", ownerAdmin], ["customer", customer], ["staff", staff], ["pending-admin", pendingAdmin]] as const) sessions.set(hash(token), account.id);

  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const raw = typeof init?.body === "string" ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : "";
    calls.push({ method, path: url.pathname, body: raw });
    const body = () => JSON.parse(raw || "{}") as Record<string, unknown>;
    const eq = (key: string) => url.searchParams.get(key)?.replace(/^eq\./, "");
    if (url.hostname === "api.line.me") {
      const subject = lineSubjects[new URLSearchParams(raw).get("id_token") ?? ""];
      return subject ? Response.json({ sub: subject, aud: "2012159405" }) : Response.json({ error: "invalid" }, { status: 400 });
    }
    if (url.pathname === "/auth/v1/token") {
      const { email, password } = body();
      const user = [...users.values()].find((item) => item.email === email && item.password === password);
      return user ? Response.json({ access_token: "t", token_type: "bearer", expires_in: 3600, refresh_token: "r", user: { id: user.id, email: user.email } }) : Response.json({ error: "invalid_grant" }, { status: 400 });
    }
    if (url.pathname === "/auth/v1/admin/users" && method === "GET") return Response.json({ users: [...users.values()].map(({ id, email }) => ({ id, email })) });
    if (url.pathname === "/auth/v1/admin/users" && method === "POST") {
      const { email, password } = body();
      if ([...users.values()].some((user) => user.email === email)) return Response.json({ code: "email_exists", msg: "already registered" }, { status: 422 });
      const user = addUser(String(email), String(password));
      return Response.json({ id: user.id, email: user.email });
    }
    if (url.pathname.startsWith("/auth/v1/admin/users/")) {
      const id = url.pathname.split("/").at(-1)!;
      const user = users.get(id);
      if (method === "DELETE") { users.delete(id); for (const [key, row] of accounts) if (row.auth_user_id === id) accounts.delete(key); return Response.json({}); }
      return user ? Response.json({ id: user.id, email: user.email }) : Response.json({ msg: "missing" }, { status: 404 });
    }
    if (url.pathname === "/rest/v1/app_sessions" && method === "GET") {
      const account = accounts.get(sessions.get(eq("token_hash") ?? "") ?? "");
      return Response.json(account ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: account } : null);
    }
    if (url.pathname === "/rest/v1/app_sessions" && method === "POST") { const row = body(); sessions.set(String(row.token_hash), String(row.account_id)); return new Response(null, { status: 201 }); }
    if (url.pathname === "/rest/v1/app_accounts" && method === "GET") {
      const rows = [...accounts.values()].filter((row) => ["id", "role", "auth_user_id", "status"].every((key) => !url.searchParams.has(key) || String(row[key as keyof Account]) === eq(key)));
      return Response.json(url.searchParams.has("auth_user_id") ? rows[0] ?? null : rows);
    }
    if (url.pathname === "/rest/v1/app_accounts" && method === "POST") {
      const row = body() as Omit<Account, "id" | "created_at">;
      if (options.failAdminInsert && row.role === "admin") return Response.json({ code: "XX000", message: "insert failed" }, { status: 500 });
      if ([...accounts.values()].some((item) => item.role === row.role && item.auth_user_id === row.auth_user_id)) return Response.json({ code: "23505", message: "duplicate key app_accounts_role_auth_user_id_key" }, { status: 409 });
      return Response.json(addAccount(row), { status: 201 });
    }
    if (url.pathname === "/rest/v1/app_accounts" && method === "PATCH") {
      const row = accounts.get(eq("id") ?? "");
      if (!row || row.status !== eq("status") || row.line_subject !== null) return Response.json(null);
      Object.assign(row, body());
      return Response.json(row);
    }
    throw new Error(`Unexpected fake request ${method} ${url.pathname}`);
  }));
  return { users, accounts, sessions, calls, owner, staffUser, pendingAdmin };
}

function post(path: string, body: unknown, token?: string, method = "POST") {
  return new Request(`http://localhost:3000${path}`, { method, body: JSON.stringify(body),
    headers: { origin: "http://localhost:3000", "content-type": "application/json", ...(token ? { cookie: `tonphueng_session=${token}` } : {}) } });
}
const login = (body: Record<string, unknown>) => passwordLogin(post("/api/auth/password", body));
const sessionToken = (response: Response) => /tonphueng_session=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1];

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Admin invitation and LINE binding", () => {
  it("validates the invitation body strictly", () => {
    expect(parseAdminInvite({ email: " New@Example.test ", password: "initial-password" })).toEqual({ email: "new@example.test", password: "initial-password" });
    expect(parseAdminInvite({ email: "new@example.test", password: "short" })).toBeNull();
    expect(parseAdminInvite({ email: "new@example.test", password: "initial-password", role: "admin", status: "active" })).toBeNull();
    expect(parseAdminInvite({ email: "not-an-email", password: "initial-password" })).toBeNull();
  });

  it("lets only an active Admin add Admins; Customer, Staff and pending Admins are rejected even on direct calls", async () => {
    const fake = installFake();
    for (const token of ["customer", "staff", "pending-admin", "unknown"]) {
      expect((await addAdmin(post("/api/admin/admins", { email: "x@example.test", password: "initial-password" }, token))).status).toBe(403);
      expect((await listAdminsRoute(new Request("http://localhost:3000/api/admin/admins", { headers: { cookie: `tonphueng_session=${token}` } }))).status).toBe(403);
    }
    expect((await adminPackages(new Request("http://localhost:3000/api/admin/packages", { headers: { cookie: "tonphueng_session=pending-admin" } }))).status).toBe(403);
    expect((await approveStaff(post(`/api/admin/staff/${fake.pendingAdmin.id}/approve`, {}, "pending-admin"), { params: Promise.resolve({ accountId: fake.pendingAdmin.id }) })).status).toBe(403);
    expect(fake.calls.some((call) => call.path.startsWith("/auth/v1/admin/users") || (call.path === "/rest/v1/app_accounts" && call.method !== "GET"))).toBe(false);
  });

  it("adds a new Admin who must accept and bind a verified LINE before entering, then must keep that LINE", async () => {
    const fake = installFake();
    const added = await addAdmin(post("/api/admin/admins", { email: "new@example.test", password: "initial-password" }, "owner"));
    expect(added.status).toBe(201);
    const addedText = await added.text();
    expect(JSON.parse(addedText)).toMatchObject({ outcome: "created" });
    expect(addedText).not.toContain("initial-password");
    const invitee = [...fake.users.values()].find((user) => user.email === "new@example.test")!;
    expect(invitee.password).toBe("initial-password");
    const row = [...fake.accounts.values()].find((item) => item.auth_user_id === invitee.id)!;
    expect(row).toMatchObject({ role: "admin", status: "pending", line_subject: null });

    const credentials = { role: "admin", email: "new@example.test", password: "initial-password" };
    expect((await login(credentials)).status).toBe(401);
    expect((await login({ ...credentials, lineIdToken: "bad.line.token" })).status).toBe(401);
    expect((await login({ ...credentials, lineIdToken: "line.new.token", acceptAdminRole: "yes" })).status).toBe(409);
    const prompt = await login({ ...credentials, lineIdToken: "line.new.token" });
    expect(prompt.status).toBe(409);
    expect(await prompt.json()).toMatchObject({ code: "admin_acceptance_required" });
    expect(prompt.headers.get("set-cookie")).toBeNull();
    expect(row).toMatchObject({ status: "pending", line_subject: null });

    const accepted = await login({ ...credentials, lineIdToken: "line.new.token", acceptAdminRole: true });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ role: "admin", redirectTo: "/admin" });
    expect(row).toMatchObject({ status: "active", line_subject: "U_new_admin" });
    expect(fake.sessions.get(hash(sessionToken(accepted)!))).toBe(row.id);
    expect(JSON.stringify([...fake.accounts.values()])).not.toContain("line.new.token");

    expect((await login({ ...credentials, lineIdToken: "line.other.token", acceptAdminRole: true })).status).toBe(403);
    expect(row.line_subject).toBe("U_new_admin");
    const again = await login({ ...credentials, lineIdToken: "line.new.token" });
    expect(again.status).toBe(200);
    expect((await addAdmin(post("/api/admin/admins", { email: "third@example.test", password: "initial-password" }, sessionToken(again)))).status).toBe(201);
  });

  it("adds an Admin row to an existing Auth user without changing its password; the same email enters each area by selected role", async () => {
    const fake = installFake();
    const added = await addAdmin(post("/api/admin/admins", { email: "staff@example.test", password: "a-new-password-x" }, "owner"));
    expect(added.status).toBe(201);
    const body = await added.json();
    expect(body.outcome).toBe("existing_user");
    expect(body.message).toContain("บัญชีนี้มีอยู่แล้ว ผู้รับใช้รหัสผ่านเดิมเข้าสู่ระบบ");
    expect(fake.calls.some((call) => call.path === "/auth/v1/admin/users" && call.method === "POST")).toBe(false);
    expect(fake.users.get(fake.staffUser.id)?.password).toBe("staff-password-123");
    const duplicate = await addAdmin(post("/api/admin/admins", { email: "staff@example.test", password: "a-new-password-x" }, "owner"));
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).code).toBe("admin_exists");
    expect((await addAdmin(post("/api/admin/admins", { email: "owner@example.test", password: "a-new-password-x" }, "owner"))).status).toBe(409);

    expect((await login({ role: "admin", email: "staff@example.test", password: "a-new-password-x", lineIdToken: "line.new.token", acceptAdminRole: true })).status).toBe(401);
    const asAdmin = await login({ role: "admin", email: "staff@example.test", password: "staff-password-123", lineIdToken: "line.new.token", acceptAdminRole: true });
    expect(asAdmin.status).toBe(200);
    expect((await asAdmin.json()).redirectTo).toBe("/admin");
    const asStaff = await login({ role: "staff", email: "staff@example.test", password: "staff-password-123" });
    expect(asStaff.status).toBe(200);
    expect((await asStaff.json()).redirectTo).toBe("/staff");
    const adminAccount = fake.accounts.get(fake.sessions.get(hash(sessionToken(asAdmin)!))!)!;
    const staffAccount = fake.accounts.get(fake.sessions.get(hash(sessionToken(asStaff)!))!)!;
    expect([adminAccount.role, staffAccount.role]).toEqual(["admin", "staff"]);
    expect(adminAccount.auth_user_id).toBe(staffAccount.auth_user_id);
    expect((await adminPackages(new Request("http://localhost:3000/api/admin/packages", { headers: { cookie: `tonphueng_session=${sessionToken(asStaff)}` } }))).status).toBe(403);
    expect((await login({ role: "admin", email: "owner@example.test", password: "owner-password-123", lineIdToken: "line.owner.token" })).status).toBe(200);
    expect((await login({ role: "staff", email: "owner@example.test", password: "owner-password-123" })).status).toBe(403);
  });

  it("removes a newly created Auth user when the pending Admin row cannot be written", async () => {
    const fake = installFake({ failAdminInsert: true });
    const response = await addAdmin(post("/api/admin/admins", { email: "new@example.test", password: "initial-password" }, "owner"));
    expect(response.status).toBe(503);
    expect([...fake.users.values()].some((user) => user.email === "new@example.test")).toBe(false);
    expect(fake.calls.some((call) => call.path.startsWith("/auth/v1/admin/users/") && call.method === "DELETE")).toBe(true);
  });
});
