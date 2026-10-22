import {
  appendClearedSessionCookie,
  readSessionCookie,
  revokeSession,
  validJsonPost,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = new Headers({
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  if (!validJsonPost(request)) return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403, headers });
  const token = readSessionCookie(request);
  if (token) {
    try {
      await revokeSession(token);
    } catch {
      return Response.json({ error: "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 503, headers });
    }
  }
  appendClearedSessionCookie(headers);
  return Response.json({ redirectTo: "/login" }, { headers });
}
