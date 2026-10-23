import { validJsonPost } from "../../../lib/auth";
import { createProductOrder, errorCode, listCustomerOrders, validCreateOrderInput } from "../../../lib/orders";
import { PackageRequestTooLargeError, readBoundedPackageJson } from "../../../lib/packages";
import { requireCustomer } from "../../../lib/services";

export const runtime = "nodejs";
const response = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

export async function GET(request: Request) {
  const customer = await requireCustomer(request);
  if (!customer) return response(403, { error: "เข้าสู่ระบบด้วยบัญชีลูกค้าเพื่อดูคำสั่งซื้อ" });
  try { return response(200, { orders: await listCustomerOrders(customer.id) }); }
  catch { return response(503, { error: "โหลดคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่" }); }
}

export async function POST(request: Request) {
  if (!validJsonPost(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  const customer = await requireCustomer(request);
  if (!customer) return response(403, { error: "เข้าสู่ระบบด้วยบัญชีลูกค้าเพื่อสั่งซื้อ" });
  let body: unknown;
  try { body = await readBoundedPackageJson(request, 1024); }
  catch (error) { return response(error instanceof PackageRequestTooLargeError ? 413 : 400, { error: "ข้อมูลคำสั่งซื้อไม่ถูกต้อง" }); }
  if (!validCreateOrderInput(body)) return response(400, { error: "ข้อมูลคำสั่งซื้อไม่ถูกต้อง ราคา ค่าส่ง และเจ้าของได้รับจากระบบเท่านั้น" });
  try { return response(201, { order: await createProductOrder(customer.id, body) }); }
  catch (error) {
    const code = errorCode(error);
    if (code === "23505") return response(409, { code: "request_reused", error: "รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว กรุณาโหลดหน้าใหม่" });
    if (code === "40001") return response(409, { code: "cart_changed", error: "ตะกร้าเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่ก่อนสั่งซื้อ" });
    if (code === "P0002") return response(409, { code: "cart_empty", error: "ตะกร้าว่าง กรุณาเลือกสินค้าก่อนสั่งซื้อ" });
    if (code === "22023") return response(409, { code: "cart_unavailable", error: "ร้านหรือสินค้าบางรายการไม่พร้อมจำหน่ายแล้ว กรุณาแก้ตะกร้าก่อนสั่งซื้อ" });
    if (code === "42501") return response(403, { error: "บัญชีนี้สั่งซื้อไม่ได้" });
    return response(503, { error: "สร้างคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่" });
  }
}
