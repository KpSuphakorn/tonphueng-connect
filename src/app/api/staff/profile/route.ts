import { hasValidSameOrigin } from "../../../../lib/auth";
import { createServiceClient } from "../../../../lib/supabase";
import { deleteStaffPhotos, filesFrom, formProfile, readStaffForm, requireStaff, StaffFormError, StaffPhotoUploadError, uploadStaffPhotos, validatePhotos } from "../../../../lib/staff";

export const runtime = "nodejs";

function response(status: number, body: Record<string, string | boolean>) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function POST(request: Request) {
  if (request.method !== "POST" || !hasValidSameOrigin(request) || !request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return response(403, { error: "คำขอไม่ถูกต้อง" });
  }
  let form: FormData;
  try {
    form = await readStaffForm(request);
  } catch (error) {
    return response(error instanceof StaffFormError ? error.status : 400, { error: error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง" });
  }
  const account = await requireStaff(request);
  if (!account) return response(403, { error: "ไม่มีสิทธิ์จัดการข้อมูลผู้ประกอบการ" });
  const profile = formProfile(form);
  if (!profile) return response(400, { error: "กรุณากรอกข้อมูลกิจการให้ครบถ้วน" });

  let photoBuffers: Buffer[];
  try {
    photoBuffers = await validatePhotos(filesFrom(form));
  } catch (error) {
    return response(400, { error: error instanceof Error ? error.message : "รูปภาพไม่ถูกต้อง" });
  }

  const client = createServiceClient();
  const { data: current, error: readError } = await client.from("services")
    .select("id,account_id,photo_paths")
    .eq("account_id", account.id)
    .maybeSingle();
  if (readError || !current) return response(404, { error: "ไม่พบข้อมูลกิจการของบัญชีนี้" });

  let newPaths: string[] = [];
  let profileWriteAttempted = false;
  try {
    if (photoBuffers.length) {
      try {
        newPaths = await uploadStaffPhotos(account.id, photoBuffers);
      } catch (error) {
        if (error instanceof StaffPhotoUploadError) newPaths = error.uploadedPaths;
        throw error;
      }
    }
    profileWriteAttempted = true;
    const { error } = await client.from("services")
      .update({ ...profile, ...(photoBuffers.length ? { photo_paths: newPaths } : {}), updated_at: new Date().toISOString() })
      .eq("account_id", account.id)
      .select("id")
      .single();
    if (error) {
      throw new Error("Could not update business profile");
    }
  } catch {
    if (profileWriteAttempted) {
      console.error("Staff profile write outcome uncertain", { reference: account.id, photoPaths: newPaths });
      return response(503, {
        error: `ยืนยันผลการบันทึกไม่ได้ กรุณาโหลดหน้าเพื่อตรวจสอบก่อนบันทึกซ้ำ (รหัสอ้างอิง ${account.id})`,
        verify_required: true,
        reference: account.id,
      });
    }
    try {
      await deleteStaffPhotos(newPaths);
    } catch {
      console.error("Staff profile photo cleanup required", { reference: account.id, photoPaths: newPaths, failures: ["storage_cleanup_failed"] });
      return response(503, {
        error: `บันทึกไม่สำเร็จและล้างรูปบางส่วนไม่สำเร็จ กรุณาติดต่อผู้ดูแลโครงการพร้อมรหัสอ้างอิง ${account.id}`,
        cleanup_required: true,
        reference: account.id,
      });
    }
    return response(503, { error: "บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง" });
  }
  if (newPaths.length) {
    try { await deleteStaffPhotos(current.photo_paths ?? []); } catch { /* The saved profile now points at the replacement photos. */ }
  }
  return response(200, { message: "บันทึกข้อมูลกิจการแล้ว" });
}
