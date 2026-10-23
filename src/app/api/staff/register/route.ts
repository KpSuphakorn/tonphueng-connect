import { hasValidSameOrigin, verifyEmailPassword } from "../../../../lib/auth";
import { createServiceClient } from "../../../../lib/supabase";
import { deleteStaffPhotos, formProfile, readStaffForm, readStagedStaffPhotos, StaffFormError, StaffPhotoUploadError, uploadStaffPhotos } from "../../../../lib/staff";
import { claimStaffPhotoUploadSession, finishStaffPhotoUploadSession } from "../../../../lib/staff-photo-uploads";

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

  const uploadSession = form.get("upload_session");
  if (typeof uploadSession !== "string" || form.has("photos")) return response(400, { error: "กรุณาแนบรูปกิจการอย่างน้อย 1 รูป" });
  const claimed = await claimStaffPhotoUploadSession(uploadSession, "registration", null);
  if (!claimed) return response(400, { error: "ชุดอัปโหลดรูปหมดอายุหรือถูกใช้แล้ว กรุณาเลือกและอัปโหลดรูปใหม่" });
  let photos: Buffer[];
  try {
    photos = await readStagedStaffPhotos(claimed.staging_paths);
  } catch (error) {
    await finishStaffPhotoUploadSession(claimed.id, "failed");
    return response(400, { error: error instanceof Error ? error.message : "รูปภาพไม่ถูกต้อง" });
  }

  const client = createServiceClient();
  let authUserId: string | undefined;
  let createdAuthUserId: string | undefined;
  let accountId: string | undefined;
  let photoPaths: string[] = [];
  let serviceWriteAttempted = false;
  try {
    const { data: authData, error: authError } = await client.auth.admin.createUser({ email, password, email_confirm: true });
    if (authError || !authData.user) {
      // The email may already have an Auth user (for example an Admin). Only its owner, proven by the
      // current password, may add a Staff role to it; the existing password is never changed.
      const existingAuthUserId = await verifyEmailPassword(email, password);
      if (!existingAuthUserId) {
        await finishStaffPhotoUploadSession(claimed.id, "failed");
        return response(409, { error: "สมัครด้วยอีเมลนี้ไม่ได้ หากอีเมลนี้มีบัญชีในระบบอยู่แล้ว กรุณากรอกรหัสผ่านปัจจุบันของบัญชีนั้น" });
      }
      authUserId = existingAuthUserId;
    } else {
      createdAuthUserId = authData.user.id;
      authUserId = createdAuthUserId;
    }

    const { data: account, error: accountError } = await client.from("app_accounts")
      .insert({ role: "staff", status: "pending", auth_user_id: authUserId })
      .select("id")
      .single();
    if (accountError?.code === "23505" && !createdAuthUserId) {
      await finishStaffPhotoUploadSession(claimed.id, "failed");
      return response(409, { error: "อีเมลนี้สมัครเป็นผู้ประกอบการไว้แล้ว กรุณาเข้าสู่ระบบหรือรอผู้ดูแลอนุมัติ" });
    }
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
    await finishStaffPhotoUploadSession(claimed.id, "completed");
    return response(201, { status: "pending", message: "ส่งข้อมูลแล้ว บัญชีของคุณกำลังรอผู้ดูแลตรวจสอบ" });
  } catch {
    if (serviceWriteAttempted) {
      const reference = accountId ?? authUserId ?? crypto.randomUUID();
      console.error("Staff registration outcome uncertain", { reference, accountId: accountId ?? null, authUserId: authUserId ?? null, photoPaths });
      await finishStaffPhotoUploadSession(claimed.id, "completed");
      return response(503, {
        error: `ระบบยืนยันผลการสมัครไม่ได้ กรุณาติดต่อ Admin พร้อมรหัสอ้างอิง ${reference} และอย่าสมัครซ้ำก่อนตรวจสอบ`,
        verify_required: true,
        reference,
      });
    }
    const failures: string[] = [];
    await finishStaffPhotoUploadSession(claimed.id, "failed");
    try { await deleteStaffPhotos(photoPaths); } catch { failures.push("storage_cleanup_failed"); }
    if (createdAuthUserId) {
      try {
        const { error } = await client.auth.admin.deleteUser(createdAuthUserId);
        if (error) failures.push("auth_user_cleanup_failed");
      } catch { failures.push("auth_user_cleanup_failed"); }
    } else if (accountId) {
      // Existing Auth user: remove only the Staff row this request added, never the user or its other roles.
      try {
        const { error } = await client.from("app_accounts").delete().eq("id", accountId).eq("role", "staff");
        if (error) failures.push("account_cleanup_failed");
      } catch { failures.push("account_cleanup_failed"); }
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
