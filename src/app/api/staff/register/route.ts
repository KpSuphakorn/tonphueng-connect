import { hasValidSameOrigin } from "../../../../lib/auth";
import { createServiceClient } from "../../../../lib/supabase";
import { deleteStaffPhotos, filesFrom, formProfile, readStaffForm, StaffFormError, StaffPhotoUploadError, uploadStaffPhotos, validatePhotos } from "../../../../lib/staff";

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
    return response(error instanceof StaffFormError ? error.status : 400, { error: error instanceof Error ? error.message : "ข้อมูลสมัครไม่ถูกต้อง" });
  }
  const profile = formProfile(form);
  const email = form.get("email");
  const password = form.get("password");
  if (!profile || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return response(400, { error: "กรุณากรอกข้อมูลกิจการ อีเมล และรหัสผ่านให้ครบถ้วน" });
  }

  let photos: Buffer[];
  try {
    photos = await validatePhotos(filesFrom(form));
    if (!photos.length) return response(400, { error: "กรุณาแนบรูปกิจการอย่างน้อย 1 รูป" });
  } catch (error) {
    return response(400, { error: error instanceof Error ? error.message : "รูปภาพไม่ถูกต้อง" });
  }

  const client = createServiceClient();
  let authUserId: string | undefined;
  let accountId: string | undefined;
  let photoPaths: string[] = [];
  let serviceWriteAttempted = false;
  try {
    const { data: authData, error: authError } = await client.auth.admin.createUser({ email, password, email_confirm: true });
    if (authError || !authData.user) return response(409, { error: "อีเมลนี้อาจมีบัญชีอยู่แล้ว หรือระบบสร้างบัญชีไม่สำเร็จ" });
    const createdAuthUserId = authData.user.id;
    authUserId = createdAuthUserId;

    const { data: account, error: accountError } = await client.from("app_accounts")
      .insert({ role: "staff", status: "pending", auth_user_id: createdAuthUserId })
      .select("id")
      .single();
    if (accountError || !account) throw new Error("Could not create pending staff account");
    const createdAccountId = account.id;
    accountId = createdAccountId;
    try {
      photoPaths = await uploadStaffPhotos(createdAccountId, photos);
    } catch (error) {
      if (error instanceof StaffPhotoUploadError) photoPaths = error.uploadedPaths;
      throw error;
    }

    serviceWriteAttempted = true;
    const { error: serviceError } = await client.from("services").insert({ ...profile, account_id: createdAccountId, photo_paths: photoPaths });
    if (serviceError) throw new Error("Could not create business profile");
    return response(201, { status: "pending", message: "ส่งข้อมูลแล้ว บัญชีของคุณกำลังรอผู้ดูแลตรวจสอบ" });
  } catch {
    if (serviceWriteAttempted) {
      const reference = accountId ?? authUserId ?? crypto.randomUUID();
      console.error("Staff registration outcome uncertain", { reference, accountId: accountId ?? null, authUserId: authUserId ?? null, photoPaths });
      return response(503, {
        error: `ระบบยืนยันผลการสมัครไม่ได้ กรุณาติดต่อ Admin พร้อมรหัสอ้างอิง ${reference} และอย่าสมัครซ้ำก่อนตรวจสอบ`,
        verify_required: true,
        reference,
      });
    }
    const failures: string[] = [];
    try { await deleteStaffPhotos(photoPaths); } catch { failures.push("storage_cleanup_failed"); }
    if (authUserId) {
      try {
        const { error } = await client.auth.admin.deleteUser(authUserId);
        if (error) failures.push("auth_user_cleanup_failed");
      } catch { failures.push("auth_user_cleanup_failed"); }
    }
    if (failures.length) {
      const reference = accountId ?? authUserId ?? crypto.randomUUID();
      console.error("Staff registration cleanup required", { reference, accountId: accountId ?? null, authUserId: authUserId ?? null, photoPaths, failures });
      return response(503, {
        error: `ส่งข้อมูลไม่สำเร็จและล้างข้อมูลบางส่วนไม่สำเร็จ กรุณาติดต่อผู้ดูแลโครงการพร้อมรหัสอ้างอิง ${reference}`,
        cleanup_required: true,
        reference,
      });
    }
    return response(503, { error: "ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง" });
  }
}
