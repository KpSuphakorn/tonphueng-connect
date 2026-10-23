import { createServiceClient } from "./supabase";
import { sendLinePush } from "./line-messaging";

export function parseFeedbackReply(text: string) {
  const match = /^\s*FB\s+([A-F0-9]{6})\s+([\s\S]{1,2000})$/i.exec(text);
  return match ? { code: match[1].toUpperCase(), feedback: match[2].trim().slice(0, 2000) } : null;
}

export async function saveFeedbackReply(lineSubject: string, text: string) {
  const parsed = parseFeedbackReply(text);
  if (!parsed || !parsed.feedback) return "not_feedback";
  const { data, error } = await createServiceClient().rpc("save_line_feedback", {
    target_line_subject: lineSubject, target_code: parsed.code, target_feedback: parsed.feedback,
  });
  if (error) throw new Error("Could not save Feedback");
  return data as string;
}

export async function sendDueFeedback(now = new Date()) {
  if (process.env.FEEDBACK_ENABLED !== "true") return { sent: 0, failed: 0, uncertain: 0, disabled: true };
  const client = createServiceClient();
  const summary = { sent: 0, failed: 0, uncertain: 0, disabled: false };
  const startedAt = Date.now();
  const requestNow = () => new Date(now.getTime() + Date.now() - startedAt);
  const attemptedIds: string[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await client.rpc("claim_due_line_feedback", { target_now: requestNow().toISOString(), target_limit: 1, target_exclude_ids: attemptedIds });
    if (error) throw new Error("Could not claim due Feedback");
    const row = (data ?? [])[0] as { id: string; retry_key: string; payload: Record<string, unknown>; first_attempt_at: string } | undefined;
    if (!row) break;
    attemptedIds.push(row.id);
    const deadline = Date.parse(row.first_attempt_at) + 24 * 60 * 60 * 1000;
    if (!Number.isFinite(deadline) || requestNow().getTime() >= deadline - 60_000) {
      await client.from("line_feedback_requests").update({ status: "uncertain", lease_until: null, updated_at: requestNow().toISOString() }).eq("id", row.id).eq("status", "sending");
      summary.uncertain++;
      continue;
    }
    const result = await sendLinePush(row.payload, row.retry_key);
    const status = result.result === "accepted" ? "accepted" : result.result === "blocked" ? "blocked" : result.result;
    const updated = await client.from("line_feedback_requests").update({ status, lease_until: null, accepted_request_id: result.acceptedRequestId, sent_at: result.result === "accepted" ? requestNow().toISOString() : null, updated_at: requestNow().toISOString() }).eq("id", row.id).eq("status", "sending");
    if (updated.error) { summary.uncertain++; continue; }
    if (result.result === "accepted") summary.sent++;
    else if (result.result === "uncertain") summary.uncertain++;
    else summary.failed++;
  }
  return summary;
}
