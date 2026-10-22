import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { POST } from "../src/app/api/staff/photo-uploads/route";
import { cleanExpiredStaffPhotoUploads, claimStaffPhotoUploadSession } from "../src/lib/staff-photo-uploads";
import { readStagedStaffPhotos, validatePhotoBuffers } from "../src/lib/staff";

const staffAccount = { id: "22222222-2222-4222-8222-222222222222", role: "staff", status: "active", line_subject: null, auth_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };

function request(body: unknown, session?: string, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/staff/photo-uploads", {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...(session ? { cookie: `tonphueng_session=${session}` } : {}) },
    body: JSON.stringify(body),
  });
}

function installBoundary() {
  vi.stubEnv("SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  const calls: Array<{ url: URL; method: string; body: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ url, method, body });
    if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && method === "GET") return Response.json([]);
    if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && method === "PATCH") return new Response(null, { status: 204 });
    if (url.pathname === "/rest/v1/rpc/create_staff_photo_upload_session") return new Response(null, { status: 204 });
    if (url.pathname === "/storage/v1/object/upload/sign/staff-photo-staging" || url.pathname.startsWith("/storage/v1/object/upload/sign/staff-photo-staging/")) {
      const path = url.pathname.split("/storage/v1/object/upload/sign/staff-photo-staging/")[1];
      return Response.json({ url: `/object/upload/sign/staff-photo-staging/${path}?token=signed-token` });
    }
    if (url.pathname === "/rest/v1/app_sessions" && method === "GET") {
      const hash = createHash("sha256").update("active-staff-session").digest("hex");
      return Response.json(url.searchParams.get("token_hash") === `eq.${hash}` ? { expires_at: "2999-01-01T00:00:00.000Z", app_accounts: staffAccount } : null);
    }
    throw new Error(`Unexpected request ${method} ${url.pathname}`);
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("scoped Staff photo upload preparation", () => {
  it("creates server-owned paths and returns only per-path signed binary upload URLs", async () => {
    const calls = installBoundary();
    const response = await POST(request({ flow: "registration", count: 2 }));
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.uploads).toHaveLength(2);
    expect(result.session).toMatch(/^[A-Za-z0-9_-]{40,50}$/);
    expect(result.uploads.map((upload: { path: string }) => upload.path)).toMatchObject([
      expect.stringMatching(/^[0-9a-f-]{36}\/1-[0-9a-f-]{36}\.upload$/),
      expect.stringMatching(/^[0-9a-f-]{36}\/2-[0-9a-f-]{36}\.upload$/),
    ]);
    expect(JSON.stringify(result)).not.toContain("service-test-key");
    const issue = calls.find((call) => call.url.pathname === "/rest/v1/rpc/create_staff_photo_upload_session");
    const manifest = JSON.parse(issue!.body);
    expect(manifest.target_flow).toBe("registration");
    expect(manifest.target_account_id).toBeNull();
    expect(manifest.target_staging_paths).toEqual(result.uploads.map((upload: { path: string }) => upload.path));
    expect(manifest.target_token_hash).not.toBe(result.session);
    expect(calls.filter((call) => call.url.pathname.includes("/object/upload/sign/staff-photo-staging/")).length).toBe(2);
  });

  it("requires an active Staff session for profile paths and rejects supplied path or size metadata", async () => {
    const calls = installBoundary();
    expect((await POST(request({ flow: "profile", count: 1 }))).status).toBe(403);
    const prepared = await POST(request({ flow: "profile", count: 1 }, "active-staff-session"));
    expect(prepared.status).toBe(201);
    const rpc = calls.find((call) => call.url.pathname === "/rest/v1/rpc/create_staff_photo_upload_session");
    expect(JSON.parse(rpc!.body).target_account_id).toBe(staffAccount.id);
    expect((await POST(request({ flow: "registration", count: 1, paths: ["someone-elses-path"], size: 5 }, undefined))).status).toBe(400);
    expect(calls.filter((call) => call.url.pathname === "/rest/v1/rpc/create_staff_photo_upload_session")).toHaveLength(1);
  });

  it("bounds JSON bytes and count even when a caller understates Content-Length", async () => {
    installBoundary();
    const oversized = new Request("http://localhost:3000/api/staff/photo-uploads", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json", "content-length": "1" },
      body: JSON.stringify({ flow: "registration", count: 1, pad: "x".repeat(1500) }),
    });
    expect((await POST(oversized)).status).toBe(413);
    expect((await POST(request({ flow: "registration", count: 20 }))).status).toBe(400);
  });

  it("does not return URLs when post-signing token retention cannot be recorded", async () => {
    installBoundary();
    const updates: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && init?.method === "GET") return Response.json([]);
      if (url.pathname === "/rest/v1/rpc/create_staff_photo_upload_session") return new Response(null, { status: 204 });
      if (url.pathname.startsWith("/storage/v1/object/upload/sign/staff-photo-staging/")) {
        const path = url.pathname.split("/storage/v1/object/upload/sign/staff-photo-staging/")[1];
        return Response.json({ url: `/object/upload/sign/staff-photo-staging/${path}?token=temporary` });
      }
      if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && init?.method === "PATCH") {
        updates.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return Response.json({ message: "temporary failure" }, { status: 503 });
      }
      throw new Error(`Unexpected request ${url.pathname}`);
    }));
    const response = await POST(request({ flow: "registration", count: 1 }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ cleanup_required: true, reference: expect.any(String) });
    expect(updates).toHaveLength(2);
    expect(updates[1]).toMatchObject({ state: "failed", token_expires_at: expect.any(String) });
  });

  it("claims each capability once and binds a profile capability to its Staff owner", async () => {
    installBoundary();
    const claims: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === "/rest/v1/rpc/claim_staff_photo_upload_session") {
        claims.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return Response.json(claims.length === 1 ? [{ id: "session", staging_paths: ["session/1-image.upload"], expires_at: "2999-01-01T00:00:00Z" }] : []);
      }
      throw new Error(`Unexpected request ${url.pathname}`);
    }));
    const token = "x".repeat(43);
    expect(await claimStaffPhotoUploadSession(token, "profile", staffAccount.id)).toMatchObject({ id: "session" });
    expect(await claimStaffPhotoUploadSession(token, "profile", staffAccount.id)).toBeNull();
    expect(claims[0]).toMatchObject({ target_flow: "profile", target_account_id: staffAccount.id });
    expect(claims[0].target_token_hash).toBe(createHash("sha256").update(token).digest("hex"));
  });

  it("rejects actual oversized bytes and aborts a staged response as soon as its stream exceeds the cap", async () => {
    installBoundary();
    await expect(validatePhotoBuffers([Buffer.alloc(5 * 1024 * 1024 + 1)])).rejects.toThrow("5 MB");
    let streamCancelled = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname.endsWith("/object/sign/staff-photo-staging/session/1-image.upload") && init?.method === "POST") {
        return Response.json({ signedURL: "/object/sign/staff-photo-staging/session/1-image.upload?token=read" });
      }
      if (url.pathname.endsWith("/object/sign/staff-photo-staging/session/1-image.upload") && init?.method !== "POST") {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(3 * 1024 * 1024));
            controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
          },
          cancel() { streamCancelled = true; },
        });
        return new Response(stream);
      }
      throw new Error(`Unexpected request ${url.pathname}`);
    }));
    await expect(readStagedStaffPhotos(["session/1-image.upload"])).rejects.toThrow("5 MB");
    expect(streamCancelled).toBe(true);
  });

  it("leaves expired manifests available for retry when bounded staging cleanup fails", async () => {
    installBoundary();
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
      if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && init?.method !== "DELETE" && init?.method !== "PATCH") {
        return Response.json([{ id: "expired-session", staging_paths: ["expired-session/1-image.upload"] }]);
      }
      if (url.pathname === "/storage/v1/object/staff-photo-staging" && init?.method === "DELETE") return Response.json({ message: "storage unavailable" }, { status: 503 });
      if (url.pathname === "/rest/v1/staff_photo_upload_sessions" && init?.method === "PATCH") return new Response(null, { status: 204 });
      throw new Error(`Unexpected request ${url.pathname}`);
    }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await cleanExpiredStaffPhotoUploads();
    expect(calls.some((call) => call.startsWith("DELETE /storage/v1/object/staff-photo-staging"))).toBe(true);
    expect(calls.some((call) => call.startsWith("DELETE /rest/v1/staff_photo_upload_sessions"))).toBe(false);
    expect(log).toHaveBeenCalledWith("Staff staged photo cleanup failed", { sessionId: "expired-session" });
  });
});
