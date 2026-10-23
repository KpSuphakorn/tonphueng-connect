import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/cron/trip-feedback/route";
import { parseFeedbackReply, sendDueFeedback } from "../src/lib/trip-feedback";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("trip Feedback", () => {
  it("requires an explicit six-character booking code and keeps Ticket 10 independent of AI", async () => {
    expect(parseFeedbackReply("ทริปดีมาก")).toBeNull();
    expect(parseFeedbackReply("FB A1B2C3 ทริปดีมาก")).toEqual({ code: "A1B2C3", feedback: "ทริปดีมาก" });
    vi.stubEnv("FEEDBACK_ENABLED", "false");
    vi.stubEnv("LINE_CHAT_ENABLED", "false");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await sendDueFeedback()).toMatchObject({ disabled: true, sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires constant-time cron bearer auth and reports disabled without database calls", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret"); vi.stubEnv("FEEDBACK_ENABLED", "false");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await GET(new Request("http://localhost/api/cron/trip-feedback"))).status).toBe(401);
    const response = await GET(new Request("http://localhost/api/cron/trip-feedback", { headers: { authorization: "Bearer cron-secret" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ disabled: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("claims each due booking before sending and persists accepted versus uncertain results", async () => {
    vi.stubEnv("SUPABASE_URL", "http://supabase.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
    vi.stubEnv("FEEDBACK_ENABLED", "true"); vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "line-test-token");
    const calls: Array<{ url: URL; method: string; body: string }> = [];
    let claimed = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : "";
      calls.push({ url, method, body });
      if (url.pathname === "/rest/v1/rpc/claim_due_line_feedback") {
        if (claimed) return Response.json([]);
        claimed = true;
        return Response.json([{ id: "request-1", retry_key: "11111111-1111-4111-8111-111111111111", first_attempt_at: "2026-10-26T04:00:00.000Z", payload: { to: `U${"a".repeat(32)}`, messages: [{ type: "text", text: "feedback" }] } }]);
      }
      if (url.pathname.endsWith("/message/push")) return new Response(null, { status: 200, headers: { "x-line-accepted-request-id": "accepted-1" } });
      if (url.pathname === "/rest/v1/line_feedback_requests") return Response.json([]);
      throw new Error(`Unexpected ${method} ${url.pathname}`);
    }));
    expect(await sendDueFeedback(new Date("2026-10-26T04:00:00.000Z"))).toMatchObject({ sent: 1, uncertain: 0 });
    const claim = calls.find((call) => call.url.pathname.endsWith("claim_due_line_feedback"));
    expect(claim!.body).toContain("target_now");
    expect(claim!.body).toContain('"target_limit":1');
    expect(calls.filter((call) => call.url.pathname.endsWith("claim_due_line_feedback"))).toHaveLength(2);
    expect(calls.filter((call) => call.url.pathname.endsWith("claim_due_line_feedback"))[1].body).toContain('"target_exclude_ids":["request-1"]');
    const push = calls.find((call) => call.url.pathname.endsWith("/message/push"));
    expect(push!.body).toContain(`U${"a".repeat(32)}`);
    expect(push!.body).toContain("feedback");
    expect(calls.find((call) => call.url.pathname === "/rest/v1/line_feedback_requests")?.body).toContain('"status":"accepted"');
  });

  it("records a provider timeout as uncertain and never claims it as accepted", async () => {
    vi.stubEnv("SUPABASE_URL", "http://supabase.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
    vi.stubEnv("FEEDBACK_ENABLED", "true"); vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "line-test-token");
    const updates: Array<Record<string, unknown>> = [];
    let claimed = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === "/rest/v1/rpc/claim_due_line_feedback") {
        if (claimed) return Response.json([]);
        claimed = true;
        return Response.json([{
          id: "request-2", retry_key: "22222222-2222-4222-8222-222222222222", first_attempt_at: new Date().toISOString(),
          payload: { to: `U${"b".repeat(32)}`, messages: [{ type: "text", text: "feedback" }] },
        }]);
      }
      if (url.pathname.endsWith("/message/push")) return Response.json({ message: "temporary failure" }, { status: 503 });
      if (url.pathname === "/rest/v1/line_feedback_requests") { updates.push(JSON.parse(String(init?.body))); return Response.json([]); }
      throw new Error(`Unexpected ${url.pathname}`);
    }));
    expect(await sendDueFeedback()).toMatchObject({ uncertain: 1, sent: 0 });
    expect(updates[0]).toMatchObject({ status: "uncertain", lease_until: null, accepted_request_id: null, sent_at: null });
  });

  it("does not spend the whole run retrying one failed row and continues to the next booking", async () => {
    vi.stubEnv("SUPABASE_URL", "http://supabase.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
    vi.stubEnv("FEEDBACK_ENABLED", "true"); vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "line-test-token");
    let claimIndex = 0;
    let pushIndex = 0;
    const calls: URL[] = [];
    const claimBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input)); calls.push(url);
      if (url.pathname === "/rest/v1/rpc/claim_due_line_feedback") {
        claimBodies.push(JSON.parse(String(init?.body)));
        claimIndex++;
        return Response.json(claimIndex <= 2 ? [{ id: `request-${claimIndex}`, retry_key: `${claimIndex}`.padStart(36, "0"), first_attempt_at: new Date().toISOString(), payload: { to: `U${"d".repeat(32)}`, messages: [{ type: "text", text: "feedback" }] } }] : []);
      }
      if (url.pathname.endsWith("/message/push")) {
        pushIndex++;
        return pushIndex === 1 ? Response.json({ message: "temporary failure" }, { status: 503 }) : new Response(null, { status: 200, headers: { "x-line-accepted-request-id": "accepted-next" } });
      }
      if (url.pathname === "/rest/v1/line_feedback_requests") return Response.json([]);
      throw new Error(`Unexpected ${url.pathname} ${init?.method ?? "GET"}`);
    }));
    expect(await sendDueFeedback()).toMatchObject({ sent: 1, uncertain: 1 });
    expect(calls.filter((url) => url.pathname.endsWith("/message/push"))).toHaveLength(2);
    const claims = calls.filter((url) => url.pathname.endsWith("claim_due_line_feedback"));
    expect(claims).toHaveLength(3);
    expect(claimBodies[1].target_exclude_ids).toEqual(["request-1"]);
  });

  it("rechecks each retry window after the previous LINE request uses time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T17:00:00.000Z"));
    vi.stubEnv("SUPABASE_URL", "http://supabase.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
    vi.stubEnv("FEEDBACK_ENABLED", "true"); vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "line-test-token");
    const updates: Array<Record<string, unknown>> = [];
    let claimIndex = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === "/rest/v1/rpc/claim_due_line_feedback") {
        claimIndex++;
        const firstAttemptAt = claimIndex === 1 ? "2026-10-22T17:01:05.000Z" : "2026-10-22T17:00:01.000Z";
        return Response.json(claimIndex <= 2 ? [{ id: `request-${claimIndex}`, retry_key: `key-${claimIndex}`, first_attempt_at: firstAttemptAt, payload: { to: `U${"c".repeat(32)}`, messages: [{ type: "text", text: "feedback" }] } }] : []);
      }
      if (url.pathname.endsWith("/message/push")) {
        await vi.advanceTimersByTimeAsync(7_000);
        return new Response(null, { status: 200, headers: { "x-line-accepted-request-id": "accepted-1" } });
      }
      if (url.pathname === "/rest/v1/line_feedback_requests") { updates.push(JSON.parse(String(init?.body))); return Response.json([]); }
      throw new Error(`Unexpected ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendDueFeedback()).toMatchObject({ sent: 1, uncertain: 1 });
    const pushCalls = fetchMock.mock.calls.filter(([input]) => new URL(input instanceof Request ? input.url : String(input)).pathname.endsWith("/message/push"));
    expect(pushCalls).toHaveLength(1);
    expect(updates).toContainEqual(expect.objectContaining({ status: "uncertain", lease_until: null }));
    const claimCalls = fetchMock.mock.calls.filter(([input]) => new URL(input instanceof Request ? input.url : String(input)).pathname.endsWith("claim_due_line_feedback"));
    expect(JSON.parse(String(claimCalls[1][1]?.body))).toMatchObject({ target_now: "2026-10-23T17:00:07.000Z", target_limit: 1 });
  });
});
