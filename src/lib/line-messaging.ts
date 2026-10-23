import { createHmac, timingSafeEqual } from "node:crypto";
import type { LineChatMessage } from "./line-chat-presentation";

const LINE_API = "https://api.line.me/v2/bot";

export function verifyLineWebhookSignature(body: Uint8Array, signature: string | null, secret: string) {
  if (!signature || !secret || signature.length > 128) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  if (signature !== expected.toString("base64")) return false;
  let provided: Buffer;
  try { provided = Buffer.from(signature, "base64"); } catch { return false; }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function boundedMessages(reply: string | LineChatMessage[] | { messages: LineChatMessage[] }): LineChatMessage[] {
  if (typeof reply === "string") return [{ type: "text", text: reply.slice(0, 4500) }];
  const source = Array.isArray(reply) ? reply : reply.messages;
  return source.slice(0, 5).map((message): LineChatMessage => {
    if (message.type === "text") return { ...message, text: message.text.slice(0, 4500) };
    return {
      ...message,
      altText: message.altText.slice(0, 400),
      contents: { type: "carousel", contents: message.contents.contents.slice(0, 3) },
    };
  });
}

export async function sendLineReply(replyToken: string, reply: string | LineChatMessage[] | { messages: LineChatMessage[] }, fetcher: typeof fetch = fetch) {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token || token.startsWith("replace_with_")) throw new Error("LINE messaging is not configured");
  const response = await fetcher(`${LINE_API}/message/reply`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ replyToken, messages: boundedMessages(reply) }),
    cache: "no-store", signal: AbortSignal.timeout(7_000),
  });
  return { ok: response.ok, status: response.status };
}

export async function sendLinePush(payload: Record<string, unknown>, retryKey: string, fetcher: typeof fetch = fetch) {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token || token.startsWith("replace_with_")) throw new Error("LINE messaging is not configured");
  let response: Response;
  try {
    response = await fetcher(`${LINE_API}/message/push`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "X-Line-Retry-Key": retryKey },
      body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(7_000),
    });
  } catch { return { result: "uncertain" as const, acceptedRequestId: null }; }
  const acceptedRequestId = response.headers.get("x-line-accepted-request-id");
  if (response.ok) return { result: "accepted" as const, acceptedRequestId };
  if (response.status === 409 && acceptedRequestId) return { result: "accepted" as const, acceptedRequestId };
  if (response.status === 403) return { result: "blocked" as const, acceptedRequestId: null };
  if (response.status === 400 || response.status === 401) return { result: "failed" as const, acceptedRequestId: null };
  return { result: "uncertain" as const, acceptedRequestId: null };
}
