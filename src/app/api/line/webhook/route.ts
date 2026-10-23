import { createServiceClient } from "../../../../lib/supabase";
import { answerLineMessage } from "../../../../lib/chat-assistance";
import { verifyLineWebhookSignature, sendLineReply } from "../../../../lib/line-messaging";
import { saveFeedbackReply } from "../../../../lib/trip-feedback";

export const runtime = "nodejs";
export const maxDuration = 45;
const MAX_BYTES = 256_000;
const MAX_CLAIMED_EVENTS = 2;
const LINE_USER = /^U[0-9a-f]{32}$/i;

async function readRaw(request: Request) {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error("too_large"); }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

function eventSubject(event: Record<string, unknown>) {
  const source = event.source;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const value = source as Record<string, unknown>;
  return value.type === "user" && typeof value.userId === "string" && LINE_USER.test(value.userId) ? value.userId : null;
}

export async function POST(request: Request) {
  let raw: Uint8Array;
  try { raw = await readRaw(request); } catch { return new Response("Payload too large", { status: 413 }); }
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET?.trim();
  if (!secret || !verifyLineWebhookSignature(raw, request.headers.get("x-line-signature"), secret)) return new Response("Unauthorized", { status: 401 });
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response("Invalid JSON", { status: 400 }); }
  const events = body && typeof body === "object" && !Array.isArray(body) ? (body as { events?: unknown }).events : null;
  if (!Array.isArray(events) || events.length > 20) return new Response("Invalid events", { status: 400 });
  if (!events.length) return new Response(null, { status: 200 });
  const client = createServiceClient();
  let claimedEvents = 0;
  for (const value of events) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const event = value as Record<string, unknown>;
    const eventId = typeof event.webhookEventId === "string" ? event.webhookEventId : "";
    const subject = eventSubject(event);
    const type = typeof event.type === "string" ? event.type : "unknown";
    if (!eventId || eventId.length > 200) continue;
    if (claimedEvents >= MAX_CLAIMED_EVENTS) return new Response("Temporary failure", { status: 503 });
    const claim = await client.rpc("claim_line_webhook_event", { target_event_id: eventId, target_line_subject: subject, target_event_type: type });
    if (claim.error) return new Response("Temporary failure", { status: 503 });
    if (claim.data === "duplicate") continue;
    if (claim.data !== "claimed") return new Response("Temporary failure", { status: 503 });
    claimedEvents++;
    let replyAttemptStarted = false;
    try {
      let errorKind: string | null = null;
      if (subject && type === "message" && event.message && typeof event.message === "object") {
        const message = event.message as Record<string, unknown>;
        if (message.type === "text" && typeof message.text === "string" && typeof event.replyToken === "string" && event.replyToken.length <= 512) {
          let reply: string;
          if (/^\s*FB\b/i.test(message.text)) {
            const saved = await saveFeedbackReply(subject, message.text);
            reply = saved === "saved" ? "ขอบคุณที่แบ่งปันความคิดเห็นครับ/ค่ะ" : saved === "duplicate" ? "ได้รับความคิดเห็นนี้แล้ว ขอบคุณครับ/ค่ะ" : saved === "not_found" ? "ไม่พบรหัส Feedback นี้ กรุณาตรวจรหัสแล้วส่งอีกครั้ง" : saved === "not_sent" ? "คำขอนี้ยังไม่พร้อมรับความคิดเห็น ลองตรวจข้อความเดิมอีกครั้ง" : "กรุณาตอบกลับรูปแบบ FB รหัส6ตัว ตามด้วยความคิดเห็น";
          } else {
            const answer = await answerLineMessage(subject, message.text);
            reply = answer.text;
            if (answer.status !== "replied") errorKind = `chat_${answer.status}`;
          }
          const prepared = await client.rpc("mark_line_webhook_reply_attempt", { target_event_id: eventId });
          if (prepared.error || prepared.data !== true) throw new Error("reply claim failed");
          replyAttemptStarted = true;
          const sent = await sendLineReply(event.replyToken, reply);
          if (!sent.ok) {
            const failed = await client.rpc("finish_line_webhook_event", { target_event_id: eventId, target_status: "failed", target_error_kind: `line_${sent.status}` });
            if (failed.error) return new Response("Temporary failure", { status: 503 });
            continue;
          }
        }
      }
      const completed = await client.rpc("finish_line_webhook_event", { target_event_id: eventId, target_status: "complete", target_error_kind: errorKind });
      if (completed.error) return new Response("Temporary failure", { status: 503 });
    } catch {
      const failed = await client.rpc("finish_line_webhook_event", {
        target_event_id: eventId,
        target_status: replyAttemptStarted ? "uncertain" : "failed",
        target_error_kind: replyAttemptStarted ? "send_uncertain" : "pre_send",
      });
      if (failed.error) return new Response("Temporary failure", { status: 503 });
      if (!replyAttemptStarted) return new Response("Temporary failure", { status: 503 });
    }
  }
  return new Response(null, { status: 200 });
}
