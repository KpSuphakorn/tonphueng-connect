import { hasValidSameOrigin, validJsonPost } from "../../../../../lib/auth";
import { confirmPackageBooking } from "../../../../../lib/packages";
import { requireCustomer } from "../../../../../lib/services";

export const runtime = "nodejs";
const response = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  if (!hasValidSameOrigin(request) || !validJsonPost(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  const account = await requireCustomer(request);
  if (!account) return response(403, { error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้า" });
  const { bookingId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return response(404, { error: "ไม่พบรายการจอง" });
  try { return response(200, { booking: await confirmPackageBooking(account.id, bookingId), message: "ชำระเงินเรียบร้อย" }); }
  catch { return response(404, { error: "ไม่พบรายการจองของคุณ" }); }
}
