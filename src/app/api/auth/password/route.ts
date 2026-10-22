import {
  appendSessionCookie,
  createSession,
  findAccountByAuthUserId,
  validJsonPost,
} from "../../../../lib/auth";
import { LineTokenError, verifyLineIdToken } from "../../../../lib/line";
import { ConfigurationError, createAuthClient, createServiceClient } from "../../../../lib/supabase";

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
    !("role" in body) ||
    (body.role !== "staff" && body.role !== "admin") ||
    !("email" in body) ||
    typeof body.email !== "string" ||
    body.email.length > 254 ||
    !("password" in body) ||
    typeof body.password !== "string" ||
    body.password.length < 1 ||
    body.password.length > 512
  ) {
    return response(400, { error: "กรุณากรอกข้อมูลเข้าสู่ระบบให้ครบ" });
  }

  try {
    let lineSubject: string | undefined;
    if (body.role === "admin") {
      if (!("lineIdToken" in body) || typeof body.lineIdToken !== "string" || !body.lineIdToken) {
        return response(401, { error: "ผู้ดูแลต้องยืนยันบัญชี LINE ที่ผูกไว้" });
      }
      lineSubject = (await verifyLineIdToken(body.lineIdToken)).subject;
    }

    const { data, error } = await createAuthClient().auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error || !data.user) return response(401, { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

    const account = await findAccountByAuthUserId(data.user.id);
    if (!account || account.role !== body.role) {
      return response(403, { error: "บัญชีนี้ไม่มีสิทธิ์เข้าพื้นที่ที่เลือก" });
    }
    if (body.role === "staff" && account.status !== "active") {
      return response(403, {
        error: account.status === "pending" ? "บัญชีกำลังรอผู้ดูแลอนุมัติ" : "บัญชีนี้ถูกปิดใช้งาน",
      });
    }
    if (body.role === "admin") {
      if (account.status === "pending" && account.line_subject === null && lineSubject) {
        const { data: boundAccount, error: bindError } = await createServiceClient()
          .from("app_accounts")
          .update({ line_subject: lineSubject, status: "active" })
          .eq("id", account.id)
          .eq("role", "admin")
          .eq("status", "pending")
          .is("line_subject", null)
          .select("id,role,status,line_subject,auth_user_id")
          .maybeSingle();

        if (bindError) return response(403, { error: "ไม่สามารถผูกบัญชี LINE นี้กับผู้ดูแลได้" });
        if (!boundAccount) {
          const refreshed = await findAccountByAuthUserId(data.user.id);
          if (!refreshed || refreshed.role !== "admin" || refreshed.status !== "active" || refreshed.line_subject !== lineSubject) {
            return response(403, { error: "บัญชี LINE ไม่ตรงกับผู้ดูแลที่ผูกไว้" });
          }
        }
      } else if (account.status !== "active" || !lineSubject || account.line_subject !== lineSubject) {
        return response(403, { error: "บัญชี LINE ไม่ตรงกับผู้ดูแลที่ผูกไว้" });
      }
    }

    const token = await createSession(account.id);
    const result = response(200, {
      role: account.role,
      redirectTo: account.role === "admin" ? "/admin" : "/staff",
    });
    appendSessionCookie(result.headers, token);
    return result;
  } catch (error) {
    if (error instanceof LineTokenError) return response(401, { error: "ยืนยัน LINE ไม่สำเร็จ กรุณาลองใหม่" });
    if (error instanceof ConfigurationError) return response(503, { error: "ระบบยังตั้งค่าไม่ครบ" });
    return response(503, { error: "ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาลองอีกครั้ง" });
  }
}
