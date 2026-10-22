import {
  appendSessionCookie,
  AuthError,
  createCustomerAccount,
  createSession,
  validJsonPost,
} from "../../../../lib/auth";
import { LineTokenError, verifyLineIdToken } from "../../../../lib/line";
import { ConfigurationError } from "../../../../lib/supabase";

export const runtime = "nodejs";

function response(status: number, body: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

export async function POST(request: Request) {
  if (!validJsonPost(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response(400, { error: "ข้อมูลไม่ถูกต้อง" });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("idToken" in body) ||
    typeof body.idToken !== "string" ||
    !body.idToken
  ) {
    return response(400, { error: "ไม่พบ LINE ID token" });
  }

  try {
    const identity = await verifyLineIdToken(body.idToken);
    const account = await createCustomerAccount(identity.subject);
    const token = await createSession(account.id);
    const result = response(200, { role: "customer", redirectTo: "/" });
    appendSessionCookie(result.headers, token);
    return result;
  } catch (error) {
    if (error instanceof LineTokenError) return response(401, { error: "ยืนยัน LINE ไม่สำเร็จ กรุณาลองใหม่" });
    if (error instanceof AuthError) return response(error.status, { error: error.message });
    if (error instanceof ConfigurationError) return response(503, { error: "ระบบยังตั้งค่าไม่ครบ" });
    return response(503, { error: "ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาลองอีกครั้ง" });
  }
}
