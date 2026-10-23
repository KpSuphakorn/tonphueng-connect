import { hasValidSameOrigin } from "../../../lib/auth";
import { clearCustomerCart, readCustomerCart, saveCustomerCart, validCartInput } from "../../../lib/cart";
import { isProductId } from "../../../lib/products";
import { requireCustomer } from "../../../lib/services";

export const runtime = "nodejs";
const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
function response(status: number, body: Record<string, unknown>) { return Response.json(body, { status, headers }); }
function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error ? String(error.message) : error instanceof Error ? error.message : "";
}

async function boundedJson(request: Request, maxBytes = 16 * 1024) {
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > maxBytes) return { tooLarge: true as const };
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return { tooLarge: true as const }; }
      chunks.push(value);
    }
    return { value: JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) as unknown };
  } catch { return { invalid: true as const }; }
}

function isJson(request: Request) { return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() === "application/json"; }

export async function GET(request: Request) {
  const customer = await requireCustomer(request);
  if (!customer) return response(403, { error: "เข้าสู่ระบบด้วยบัญชีลูกค้าเพื่อดูตะกร้า" });
  try { return response(200, { cart: await readCustomerCart(customer.id) }); }
  catch (error) {
    if (/cart unavailable/i.test(errorMessage(error))) return response(409, { code: "cart_unavailable", error: "สินค้าในตะกร้าหมดหรือร้านปิดแล้ว กรุณาแก้ตะกร้าก่อนดูยอด" });
    return response(503, { error: "โหลดตะกร้าไม่สำเร็จ กรุณาลองใหม่" });
  }
}

export async function POST(request: Request) {
  if (!hasValidSameOrigin(request) || !isJson(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  const customer = await requireCustomer(request);
  if (!customer) return response(403, { error: "เข้าสู่ระบบด้วยบัญชีลูกค้าเพื่อแก้ตะกร้า" });
  const parsed = await boundedJson(request);
  if ("tooLarge" in parsed) return response(413, { error: "ตะกร้ามีข้อมูลมากเกินไป" });
  if (!parsed || !("value" in parsed) || !validCartInput(parsed.value)) return response(400, { error: "ตรวจจำนวนสินค้าและวิธีรับสินค้าให้ถูกต้อง" });
  try { return response(200, { cart: await saveCustomerCart(customer.id, parsed.value) }); }
  catch (error) {
    const message = errorMessage(error);
    if (/cart store mismatch/i.test(message)) return response(409, { code: "cart_store_mismatch", error: "ตะกร้ามีสินค้าจากอีกร้าน กรุณายืนยันล้างตะกร้าเดิมก่อนเปลี่ยนร้าน" });
    if (/cart changed/i.test(message)) return response(409, { code: "cart_changed", error: "ตะกร้าเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่" });
    if (/unavailable|invalid|quantity/i.test(message)) return response(409, { code: "cart_unavailable", error: "ร้านหรือสินค้าบางรายการไม่พร้อมจำหน่ายแล้ว กรุณาโหลดรายการใหม่" });
    return response(503, { error: "บันทึกตะกร้าไม่สำเร็จ กรุณาลองใหม่" });
  }
}

export async function DELETE(request: Request) {
  if (!hasValidSameOrigin(request) || !isJson(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  const customer = await requireCustomer(request);
  if (!customer) return response(403, { error: "เข้าสู่ระบบด้วยบัญชีลูกค้าเพื่อแก้ตะกร้า" });
  const parsed = await boundedJson(request, 1024);
  if (!parsed || !("value" in parsed) || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) return response(400, { error: "ข้อมูลยืนยันไม่ถูกต้อง" });
  const input = parsed.value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "confirm,expected_service_id" || input.confirm !== true || !isProductId(input.expected_service_id)) return response(400, { error: "ยืนยันล้างตะกร้าก่อนเปลี่ยนร้าน" });
  try { await clearCustomerCart(customer.id, input.expected_service_id); return response(200, { cart: null }); }
  catch { return response(409, { error: "ตะกร้าเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่" }); }
}
