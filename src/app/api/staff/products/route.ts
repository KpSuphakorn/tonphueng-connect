import { hasValidSameOrigin } from "../../../../lib/auth";
import { archiveStaffProduct, listStaffProducts, saveStaffProduct, isProductId, parseProductPriceBaht } from "../../../../lib/products";
import { deleteStaffPhotos, readStagedStaffPhotos, requireStaff, StaffPhotoUploadError, uploadStaffPhotos } from "../../../../lib/staff";
import { claimStaffPhotoUploadSession, finishStaffPhotoUploadSession } from "../../../../lib/staff-photo-uploads";
import { createServiceClient } from "../../../../lib/supabase";

export const runtime = "nodejs";
const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
function response(status: number, body: Record<string, unknown>) { return Response.json(body, { status, headers: NO_STORE }); }

export async function GET(request: Request) {
  const account = await requireStaff(request);
  if (!account) return response(403, { error: "ไม่มีสิทธิ์จัดการสินค้า" });
  try { return response(200, { products: await listStaffProducts(account.id) }); }
  catch { return response(503, { error: "โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่" }); }
}

async function save(request: Request) {
  if (!hasValidSameOrigin(request) || !request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) return response(403, { error: "คำขอไม่ถูกต้อง" });
  const account = await requireStaff(request);
  if (!account) return response(403, { error: "ไม่มีสิทธิ์จัดการสินค้า" });
  let form: FormData;
  try {
    const length = request.headers.get("content-length");
    if (length && /^\d+$/.test(length) && Number(length) > 64 * 1024) return response(413, { error: "ข้อมูลสินค้าใหญ่เกินไป" });
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024) { await reader.cancel(); return response(413, { error: "ข้อมูลสินค้าใหญ่เกินไป" }); }
      chunks.push(value);
    }
    const headers = new Headers(request.headers);
    headers.delete("content-length"); headers.delete("transfer-encoding");
    form = await new Request(request.url, { method: "POST", headers, body: new Uint8Array(Buffer.concat(chunks)) }).formData();
  } catch { return response(400, { error: "ข้อมูลสินค้าไม่ถูกต้อง" }); }
  const keys = Array.from(form.keys()).sort().join(",");
  const expected = form.has("id") ? "description,id,name,price_baht,upload_session" : "description,name,price_baht,upload_session";
  const id = form.get("id");
  const name = form.get("name");
  const description = form.get("description");
  const token = form.get("upload_session");
  const rawPrice = form.get("price_baht");
  const price = typeof rawPrice === "string" ? parseProductPriceBaht(rawPrice) : null;
  if (keys !== expected || (id !== null && (typeof id !== "string" || !isProductId(id))) || typeof name !== "string" || !name.trim() || name.trim().length > 160
    || typeof description !== "string" || description.length > 4000 || !price || (token !== null && (typeof token !== "string" || token.length > 64))) {
    return response(400, { error: "กรุณาตรวจชื่อ รายละเอียด และราคาสินค้า" });
  }
  const existing = id ? await createServiceClient().from("products").select("photo_path,service_id").eq("id", id).maybeSingle() : null;
  if (existing?.error || (id && !existing?.data)) return response(404, { error: "ไม่พบสินค้านี้ในบัญชีของคุณ" });
  let claimed: Awaited<ReturnType<typeof claimStaffPhotoUploadSession>> = null;
  if (typeof token === "string" && token) {
    claimed = await claimStaffPhotoUploadSession(token, "product", account.id);
    if (!claimed) return response(400, { error: "ชุดอัปโหลดรูปหมดอายุหรือถูกใช้แล้ว กรุณาเลือกภาพใหม่" });
    if (claimed.staging_paths.length !== 1) {
      await finishStaffPhotoUploadSession(claimed.id, "failed");
      return response(400, { error: "รูปสินค้าไม่ถูกต้อง กรุณาเลือกภาพใหม่" });
    }
  } else if (!id) return response(400, { error: "กรุณาเลือกรูปสินค้า" });

  let photoBuffers: Buffer[] = [];
  try { if (claimed) photoBuffers = await readStagedStaffPhotos(claimed.staging_paths); }
  catch (error) {
    if (claimed) await finishStaffPhotoUploadSession(claimed.id, "failed");
    return response(400, { error: error instanceof Error ? error.message : "รูปสินค้าไม่ถูกต้อง" });
  }
  let photoPaths: string[] = [];
  let writeAttempted = false;
  try {
    if (photoBuffers.length) {
      try { photoPaths = await uploadStaffPhotos(account.id, photoBuffers); }
      catch (error) { if (error instanceof StaffPhotoUploadError) photoPaths = error.uploadedPaths; throw error; }
    }
    writeAttempted = true;
    const product = await saveStaffProduct(account.id, {
      id: id as string | undefined, name: name.trim(), description: description.trim(), price_satang: price,
      photo_path: photoPaths[0], keep_photo: photoPaths.length === 0,
    });
    if (claimed) await finishStaffPhotoUploadSession(claimed.id, "completed");
    const oldPath = existing?.data?.photo_path;
    if (oldPath && photoPaths.length) try { await deleteStaffPhotos([oldPath]); } catch { /* The saved Product already points at its replacement. */ }
    return response(200, { product });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (writeAttempted && !["42501", "22023", "23514"].includes(code)) {
      if (claimed) await finishStaffPhotoUploadSession(claimed.id, "completed");
      console.error("Staff product write outcome uncertain", { reference: id ?? account.id, photoPaths });
      return response(503, { error: "ยืนยันผลการบันทึกไม่ได้ กรุณาโหลดรายการสินค้าเพื่อตรวจสอบก่อนบันทึกซ้ำ", verify_required: true });
    }
    try { await deleteStaffPhotos(photoPaths); }
    catch {
      console.error("Staff product photo cleanup required", { reference: account.id, photoPaths });
      return response(503, { error: "บันทึกไม่สำเร็จและล้างรูปไม่สำเร็จ กรุณาติดต่อผู้ดูแลโครงการ", cleanup_required: true });
    }
    if (claimed) await finishStaffPhotoUploadSession(claimed.id, "failed");
    if (code === "42501") return response(404, { error: "ไม่พบสินค้าในร้านของคุณ หรือร้านไม่ได้เปิดเป็นสินค้าชุมชน" });
    if (code === "22023" || code === "23514") return response(400, { error: "ข้อมูลสินค้าไม่ถูกต้อง กรุณาตรวจชื่อ ราคา และรูปภาพ" });
    return response(503, { error: "บันทึกสินค้าไม่สำเร็จ กรุณาลองอีกครั้ง" });
  }
}

export async function POST(request: Request) { return save(request); }
export async function PUT(request: Request) { return save(request); }

export async function DELETE(request: Request) {
  if (!hasValidSameOrigin(request) || request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return response(403, { error: "คำขอไม่ถูกต้อง" });
  const account = await requireStaff(request);
  if (!account) return response(403, { error: "ไม่มีสิทธิ์จัดการสินค้า" });
  const id = new URL(request.url).searchParams.get("id");
  if (!isProductId(id)) return response(400, { error: "เลือกสินค้าให้ถูกต้อง" });
  try { await archiveStaffProduct(account.id, id); return response(200, { ok: true }); }
  catch { return response(404, { error: "ไม่พบสินค้านี้ในบัญชีของคุณ" }); }
}
