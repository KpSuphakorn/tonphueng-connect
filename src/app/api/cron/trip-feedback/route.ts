import { timingSafeEqual } from "node:crypto";
import { sendDueFeedback } from "../../../../lib/trip-feedback";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!secret || secret.startsWith("replace_with_") || !match) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(`Bearer ${match[1]}`);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json(await sendDueFeedback()); }
  catch { return Response.json({ error: "Feedback run failed" }, { status: 503 }); }
}
