import { validJsonPost } from "../../../../../../lib/auth";
import { requireAdmin } from "../../../../../../lib/staff";
import { ConfigurationError, createServiceClient } from "../../../../../../lib/supabase";

export const runtime = "nodejs";

function response(status: number, body: Record<string, string>) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function POST(request: Request, context: { params: Promise<{ accountId: string }> }) {
  if (!validJsonPost(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  if (!(await requireAdmin(request))) return response(403, { error: "ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ใช้งานได้" });
  const { accountId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return response(400, { error: "ข้อมูลบัญชีไม่ถูกต้อง" });

  try {
    const { data, error } = await createServiceClient().rpc("approve_staff_account", { target_account_id: accountId });
    if (error) throw error;
    if (!data?.length) return response(409, { error: "บัญชีนี้ไม่ได้อยู่ระหว่างรออนุมัติ" });
    return response(200, { status: "active", message: "อนุมัติผู้ประกอบการแล้ว" });
  } catch (error) {
    return response(error instanceof ConfigurationError ? 503 : 503, { error: "อนุมัติไม่สำเร็จ กรุณาลองอีกครั้ง" });
  }
}
