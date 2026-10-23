import { hasValidSameOrigin, validJsonPost } from "../../../lib/auth";
import { createPackageBooking, listPackageBookings, isPackageCategory, PackageRequestTooLargeError, readBoundedPackageJson, validateSelections } from "../../../lib/packages";
import { requireCustomer } from "../../../lib/services";
import { requireAdmin } from "../../../lib/staff";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

export async function GET(request: Request) {
  const customer = await requireCustomer(request);
  const admin = customer ? null : await requireAdmin(request);
  if (!customer && !admin) return response(403, { error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้าหรือผู้ดูแล" });
  try { return response(200, { bookings: await listPackageBookings(customer?.id) }); }
  catch { return response(503, { error: "โหลดรายการจองไม่สำเร็จ" }); }
}

export async function POST(request: Request) {
  if (!hasValidSameOrigin(request) || !validJsonPost(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  const account = await requireCustomer(request);
  if (!account) return response(403, { error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้า" });
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > 32_000)) return response(/^\d+$/.test(length) ? 413 : 400, { error: "ข้อมูลการจองไม่ถูกต้องหรือมีขนาดใหญ่เกินไป" });
  let body: unknown;
  try { body = await readBoundedPackageJson(request, 32_000); }
  catch (error) { return response(error instanceof PackageRequestTooLargeError ? 413 : 400, { error: "ข้อมูลการจองไม่ถูกต้อง" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return response(400, { error: "ข้อมูลการจองไม่ถูกต้อง" });
  const input = body as Record<string, unknown>;
  if (["customer_account_id", "customer_id", "owner_id", "price_per_person_satang", "total_price_satang", "total_price"].some((key) => Object.hasOwn(input, key))) return response(400, { error: "เจ้าของและราคาได้รับจากระบบเท่านั้น" });
  const choices = validateSelections(input.choices);
  const validDate = typeof input.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.start_date) &&
    Number.isFinite(Date.parse(`${input.start_date}T00:00:00Z`)) && new Date(`${input.start_date}T00:00:00Z`).toISOString().slice(0, 10) === input.start_date;
  if (!UUID.test(String(input.request_id)) || !isPackageCategory(input.category) || !UUID.test(String(input.sub_package_id)) ||
    !Number.isSafeInteger(input.revision) || Number(input.revision) < 1 || !choices ||
    !validDate ||
    !Number.isSafeInteger(input.participants) || Number(input.participants) < 1 || Number(input.participants) > 100) {
    return response(400, { error: "กรุณาตรวจสอบแพ็กเกจ ตัวเลือก วันที่ และจำนวนผู้เข้าร่วม (1–100 คน)" });
  }
  try {
    const booking = await createPackageBooking(account.id, { request_id: input.request_id as string, category: input.category,
      sub_package_id: input.sub_package_id as string, revision: Number(input.revision), choices,
      start_date: input.start_date as string, participants: Number(input.participants) });
    return response(201, { booking });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    return response(code === "40001" || code === "23505" ? 409 : code === "22023" ? 400 : 503,
      { error: code === "40001" ? "แพ็กเกจเปลี่ยนแปลง กรุณาโหลดหน้าใหม่ก่อนจอง" : code === "23505" ? "รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว" : code === "22023" ? "ตัวเลือก วันที่ หรือจำนวนคนไม่ตรงกับแพ็กเกจ" : "บันทึกการจองไม่สำเร็จ กรุณาลองใหม่" });
  }
}
