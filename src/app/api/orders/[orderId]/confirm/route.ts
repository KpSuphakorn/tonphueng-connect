import { validJsonPost } from "../../../../../lib/auth";
import { confirmProductOrder, errorCode } from "../../../../../lib/orders";
import { isProductId } from "../../../../../lib/products";
import { requireCustomer } from "../../../../../lib/services";

export const runtime = "nodejs";
const response = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  if (!validJsonPost(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  const customer = await requireCustomer(request);
  if (!customer) return response(403, { error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้า" });
  const { orderId } = await context.params;
  if (!isProductId(orderId)) return response(404, { error: "ไม่พบคำสั่งซื้อ" });
  try { return response(200, { order: await confirmProductOrder(customer.id, orderId), message: "ยืนยันจ่ายเงินจำลองแล้ว (ไม่มีการรับเงินจริง)" }); }
  catch (error) {
    const code = errorCode(error);
    if (code === "P0002") return response(404, { error: "ไม่พบคำสั่งซื้อของคุณ" });
    if (code === "22023") return response(409, { code: "store_unavailable", error: "ร้านนี้ปิดรับคำสั่งซื้อชั่วคราว ยังยืนยันจ่ายเงินจำลองไม่ได้" });
    if (code === "42501") return response(403, { error: "บัญชีนี้ยืนยันคำสั่งซื้อไม่ได้" });
    return response(503, { error: "ยืนยันไม่สำเร็จ กรุณาลองใหม่" });
  }
}
