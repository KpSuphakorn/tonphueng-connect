import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "../src/app/api/line/webhook/route";

const secret = "messaging-secret";
const body = (payload: unknown) => JSON.stringify(payload);
const signature = (value: string) => createHmac("sha256", secret).update(value).digest("base64");
const request = (value: string, signed = true) => new Request("http://localhost/api/line/webhook", {
  method: "POST", headers: { "x-line-signature": signed ? signature(value) : "invalid" }, body: value,
});
function setup(rpc: (name: string) => unknown) {
  vi.stubEnv("SUPABASE_URL", "http://supabase.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
  vi.stubEnv("LINE_MESSAGING_CHANNEL_SECRET", secret); vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "line-test-token");
  const calls: Array<{ url: URL; method: string; body: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const text = typeof init?.body === "string" ? init.body : "";
    calls.push({ url, method, body: text });
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const result = rpc(url.pathname.split("/").at(-1)!);
      return result instanceof Response ? result : Response.json(result);
    }
    if (url.pathname.endsWith("/message/reply")) return Response.json({});
    throw new Error(`Unexpected fetch ${method} ${url.pathname}`);
  }));
  return calls;
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("LINE webhook boundary", () => {
  it("rejects a bad signature before parsing, database access, or provider calls", async () => {
    const calls = setup(() => true);
    const response = await POST(request(body({ events: [{ type: "message" }] }), false));
    expect(response.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("accepts LINE verification requests with no events without side effects", async () => {
    const calls = setup(() => true);
    expect((await POST(request(body({ events: [] })))).status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it("handles explicit Feedback before AI and deduplicates the LINE event", async () => {
    let duplicate = false;
    const calls = setup((name) => name === "claim_line_webhook_event" ? (duplicate ? "duplicate" : "claimed")
      : name === "save_line_feedback" ? "saved" : name === "mark_line_webhook_reply_attempt" ? true : null);
    vi.stubEnv("LINE_CHAT_ENABLED", "false");
    const payload = { events: [{ type: "message", webhookEventId: "evt-1", replyToken: "reply-1",
      source: { type: "user", userId: `U${"a".repeat(32)}` }, message: { type: "text", text: "FB A1B2C3 ทริปดีมาก" } }] };
    const first = await POST(request(body(payload)));
    expect(first.status).toBe(200);
    const reply = calls.find((call) => call.url.pathname.endsWith("/message/reply"));
    expect(JSON.parse(reply!.body).messages[0].text).toContain("ขอบคุณที่แบ่งปัน");
    expect(calls.some((call) => call.url.hostname === "generativelanguage.googleapis.com")).toBe(false);
    duplicate = true;
    await POST(request(body(payload)));
    expect(calls.filter((call) => call.url.pathname.endsWith("/message/reply"))).toHaveLength(1);
  });

  it("returns a pre-send save failure for retry, then preserves and replies to the saved Feedback", async () => {
    let saveFails = true;
    const calls = setup((name) => name === "claim_line_webhook_event" ? "claimed"
      : name === "save_line_feedback" && saveFails ? Response.json({ message: "temporary database error" }, { status: 500 })
        : name === "save_line_feedback" ? "saved" : name === "mark_line_webhook_reply_attempt" ? true : null);
    vi.stubEnv("LINE_CHAT_ENABLED", "false");
    const payload = { events: [{ type: "message", webhookEventId: "evt-retry", replyToken: "reply-2",
      source: { type: "user", userId: `U${"b".repeat(32)}` }, message: { type: "text", text: "FB C3D4E5 ไปเที่ยวสนุกมาก" } }] };
    expect((await POST(request(body(payload)))).status).toBe(503);
    expect(calls.some((call) => call.url.pathname.endsWith("/message/reply"))).toBe(false);
    expect(calls.find((call) => call.url.pathname.endsWith("finish_line_webhook_event"))?.body).toContain('"target_status":"failed"');
    expect(calls.find((call) => call.url.pathname.endsWith("finish_line_webhook_event"))?.body).toContain('"target_error_kind":"pre_send"');

    saveFails = false;
    expect((await POST(request(body(payload)))).status).toBe(200);
    expect(calls.filter((call) => call.url.pathname.endsWith("/message/reply"))).toHaveLength(1);
    expect(calls.some((call) => call.url.hostname === "generativelanguage.googleapis.com")).toBe(false);
  });
});
