import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { POST as lineLogin } from "../src/app/api/auth/line/route";
import { POST as passwordLogin } from "../src/app/api/auth/password/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { getAccountForSession } from "../src/lib/auth";

const account = {
  id: "b6e31ce2-06f6-44c2-82b8-0d53d27e6635",
  role: "customer",
  status: "active",
  line_subject: "U_verified_line_subject",
  auth_user_id: null,
};

function lineRequest(body: unknown) {
  return new Request("http://localhost:3000/api/auth/line", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function passwordRequest(body: unknown) {
  return new Request("http://localhost:3000/api/auth/password", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function logoutRequest(token: string) {
  return new Request("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      cookie: `tonphueng_session=${token}`,
    },
    body: "{}",
  });
}

function setPasswordAuthBoundary(account: typeof adminAccount, verifiedSubject = "U_admin") {
  vi.stubEnv("SUPABASE_URL", "https://project.example.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
  vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "2012159405");
  const calls: Array<{ url: URL; method: string; body: string }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const method = init?.method ?? "GET";
      const body = String(init?.body ?? "");
      calls.push({ url, method, body });
      if (url.hostname === "api.line.me") {
        return Response.json({ sub: verifiedSubject, aud: "2012159405" });
      }
      if (url.pathname.includes("/auth/v1/token")) {
        return Response.json({
          access_token: "test-access-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "test-refresh-token",
          user: { id: adminAccount.auth_user_id, email: "owner@example.test" },
        });
      }
      if (url.pathname.endsWith("/app_accounts") && method === "GET") {
        const role = url.searchParams.get("role")?.slice(3);
        return Response.json(role && role !== account.role ? null : account);
      }
      if (url.pathname.endsWith("/app_accounts") && method === "PATCH") {
        return Response.json({ ...account, ...JSON.parse(body) });
      }
      if (url.pathname.endsWith("/app_sessions") && method === "POST") {
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected external request: ${method} ${url.pathname}`);
    }),
  );
  return calls;
}

const adminAccount: {
  id: string;
  role: string;
  status: string;
  line_subject: string | null;
  auth_user_id: string;
} = {
  id: "35c3d7d7-e617-4f7c-8a6d-6f1329e46dae",
  role: "admin",
  status: "pending",
  line_subject: null,
  auth_user_id: "a1cf5eec-a653-4454-906c-62c9d0415a61",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Customer LINE login HTTP behavior", () => {
  it("creates a persistent session only for the subject returned by LINE verification", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.example.test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "2012159405");

    const calls: Array<{ url: URL; method: string; body: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const method = init?.method ?? "GET";
        const body = String(init?.body ?? "");
        calls.push({ url, method, body });

        if (url.hostname === "api.line.me") {
          expect(new URLSearchParams(body).get("client_id")).toBe("2012159405");
          return Response.json({ sub: account.line_subject, aud: "2012159405" });
        }
        if (url.pathname.endsWith("/app_accounts") && method === "GET") {
          return Response.json([]);
        }
        if (url.pathname.endsWith("/app_accounts") && method === "POST") {
          return Response.json(account, { status: 201 });
        }
        if (url.pathname.endsWith("/app_sessions") && method === "POST") {
          return new Response(null, { status: 201 });
        }
        throw new Error(`Unexpected external request: ${method} ${url.pathname}`);
      }),
    );

    const response = await lineLogin(
      lineRequest({ idToken: "a.b.c", lineUserId: "U_forged_browser_value" }),
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({ role: "customer", redirectTo: "/" });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("tonphueng_session=");

    const accountInsert = calls.find(
      (call) => call.url.pathname.endsWith("/app_accounts") && call.method === "POST",
    );
    expect(accountInsert).toBeDefined();
    expect(JSON.parse(accountInsert!.body)).toMatchObject({
      role: "customer",
      status: "active",
      line_subject: account.line_subject,
    });
    expect(accountInsert!.body).not.toContain("U_forged_browser_value");
    expect(calls.some((call) => call.url.pathname.endsWith("/app_sessions"))).toBe(true);
  });

  it("rejects a request that provides browser profile data without a raw LINE token", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.example.test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "2012159405");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await lineLogin(
      lineRequest({ lineUserId: account.line_subject, displayName: "Pretend user" }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a LINE token that fails platform verification and creates no app session", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.example.test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "2012159405");
    const fetchMock = vi.fn(async () => Response.json({ error: "Invalid IdToken" }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await lineLogin(lineRequest({ idToken: "a.b.c" }));

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("binds the initial Admin only after password, verified LINE login, and explicit acceptance", async () => {
    const calls = setPasswordAuthBoundary(adminAccount);
    const credentials = { role: "admin", email: "owner@example.test", password: "a-long-secret-password", lineIdToken: "header.payload.signature" };

    const withoutAcceptance = await passwordLogin(passwordRequest(credentials));
    expect(withoutAcceptance.status).toBe(409);
    expect((await withoutAcceptance.json()).code).toBe("admin_acceptance_required");
    expect(withoutAcceptance.headers.get("set-cookie")).toBeNull();
    expect(calls.some((call) => call.url.pathname.endsWith("/app_accounts") && call.method === "PATCH")).toBe(false);

    const response = await passwordLogin(passwordRequest({ ...credentials, acceptAdminRole: true }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ role: "admin", redirectTo: "/admin" });
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    const binding = calls.find(
      (call) => call.url.pathname.endsWith("/app_accounts") && call.method === "PATCH",
    );
    expect(binding).toBeDefined();
    expect(JSON.parse(binding!.body)).toEqual({ line_subject: "U_admin", status: "active" });
    expect(binding!.url.searchParams.get("status")).toBe("eq.pending");
    expect(binding!.url.searchParams.get("line_subject")).toBe("is.null");
    expect(calls.some((call) => call.url.pathname.endsWith("/app_sessions"))).toBe(true);
  });

  it("does not let a valid password with a different LINE account enter Admin", async () => {
    const activeAdmin = { ...adminAccount, status: "active", line_subject: "U_real_admin" };
    const calls = setPasswordAuthBoundary(activeAdmin, "U_someone_else");

    const response = await passwordLogin(
      passwordRequest({
        role: "admin",
        email: "owner@example.test",
        password: "a-long-secret-password",
        lineIdToken: "header.payload.signature",
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(calls.some((call) => call.url.pathname.endsWith("/app_sessions"))).toBe(false);
  });

  it("does not grant Staff access while the account is awaiting approval", async () => {
    const pendingStaff = {
      ...adminAccount,
      role: "staff",
      status: "pending",
      line_subject: null,
    };
    const calls = setPasswordAuthBoundary(pendingStaff);

    const response = await passwordLogin(
      passwordRequest({ role: "staff", email: "owner@example.test", password: "a-long-secret-password" }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain("รอผู้ดูแลอนุมัติ");
    expect(calls.some((call) => call.url.pathname.endsWith("/app_sessions"))).toBe(false);
  });

  it("creates a Staff session only for an active Staff account", async () => {
    const activeStaff = { ...adminAccount, role: "staff", status: "active", line_subject: null };
    const calls = setPasswordAuthBoundary(activeStaff);

    const response = await passwordLogin(
      passwordRequest({ role: "staff", email: "owner@example.test", password: "a-long-secret-password" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ role: "staff", redirectTo: "/staff" });
    expect(response.headers.get("set-cookie")).toContain("tonphueng_session=");
    expect(calls.some((call) => call.url.pathname.endsWith("/app_sessions") && call.method === "POST")).toBe(true);
  });

  it("does not grant Admin when the submitted role differs from the stored role", async () => {
    const activeAdmin = { ...adminAccount, status: "active", line_subject: "U_admin" };
    const calls = setPasswordAuthBoundary(activeAdmin);

    const response = await passwordLogin(
      passwordRequest({ role: "staff", email: "owner@example.test", password: "a-long-secret-password" }),
    );

    expect(response.status).toBe(403);
    expect(calls.some((call) => call.url.pathname.endsWith("/app_sessions"))).toBe(false);
  });

  it("revokes the persisted session and clears the browser cookie on logout", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.example.test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
    const token = "random-session-token";
    let revokedUrl: URL | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        revokedUrl = new URL(input instanceof Request ? input.url : String(input));
        expect(init?.method).toBe("DELETE");
        return new Response(null, { status: 204 });
      }),
    );

    const response = await logout(logoutRequest(token));

    expect(response.status).toBe(200);
    expect(revokedUrl?.pathname).toBe("/rest/v1/app_sessions");
    expect(revokedUrl?.searchParams.get("token_hash")).toBe(
      `eq.${createHash("sha256").update(token).digest("hex")}`,
    );
    expect(response.headers.get("set-cookie")).toContain("tonphueng_session=; HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("does not resolve an expired or unknown session token to an account", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.example.test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
    const token = "tampered-or-expired-session";
    let lookupUrl: URL | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        lookupUrl = new URL(input instanceof Request ? input.url : String(input));
        return Response.json([]);
      }),
    );

    const account = await getAccountForSession(token);

    expect(account).toBeNull();
    expect(lookupUrl?.pathname).toBe("/rest/v1/app_sessions");
    expect(lookupUrl?.searchParams.get("token_hash")).toBe(
      `eq.${createHash("sha256").update(token).digest("hex")}`,
    );
    expect(lookupUrl?.searchParams.get("expires_at")).toMatch(/^gt\./);
  });
});
