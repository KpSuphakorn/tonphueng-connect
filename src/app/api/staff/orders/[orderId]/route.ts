import { hasValidSameOrigin } from "../../../../../lib/auth";
import { errorCode, errorMessage, parseStaffOrderUpdate, updateStaffOrder } from "../../../../../lib/orders";
import { PackageRequestTooLargeError, readBoundedPackageJson } from "../../../../../lib/packages";
import { isProductId } from "../../../../../lib/products";
import { requireStaff } from "../../../../../lib/staff";

export const runtime = "nodejs";
const response = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const isJson = (request: Request) => request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";

export async function PATCH(request: Request, context: { params: Promise<{ orderId: string }> }) {
  if (!hasValidSameOrigin(request) || !isJson(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  const staff = await requireStaff(request);
  if (!staff) return response(403, { error: "ไม่มีสิทธิ์จัดการคำสั่งซื้อ" });
  const { orderId } = await context.params;
  if (!isProductId(orderId)) return response(404, { error: "ไม่พบคำสั่งซื้อของร้านคุณ" });
  let body: unknown;
  try { body = await readBoundedPackageJson(request, 1024); }
  catch (error) { return response(error instanceof PackageRequestTooLargeError ? 413 : 400, { error: "ข้อมูลไม่ถูกต้อง" }); }
  const input = parseStaffOrderUpdate(body);
  if (!input) return response(400, { error: "เลือกสถานะให้ถูกต้อง เลขพัสดุใช้ตัวอักษรอังกฤษ ตัวเลข และ - . / ได้ไม่เกิน 60 ตัว" });
  try { return response(200, { order: await updateStaffOrder(staff.id, orderId, input), message: "บันทึกสถานะแล้ว" }); }
  catch (error) {
    const code = errorCode(error); const message = errorMessage(error);
    if (code === "42501" || code === "P0002") return response(404, { error: "ไม่พบคำสั่งซื้อของร้านคุณ" });
    if (/pickup/i.test(message)) return response(400, { error: "ออเดอร์รับที่ร้านไม่ต้องกรอกเลขพัสดุ" });
    if (/backward/i.test(message)) return response(400, { error: "ย้อนสถานะกลับไม่ได้" });
    if (code === "22023") return response(400, { error: "สถานะหรือเลขพัสดุไม่ถูกต้อง" });
    return response(503, { error: "บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่" });
  }
}
