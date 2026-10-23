import { validJsonPost } from "../../../../lib/auth";
import { AdminInvitationError, inviteAdmin, listAdmins, parseAdminInvite } from "../../../../lib/admin-invitations";
import { PackageRequestTooLargeError, readBoundedPackageJson } from "../../../../lib/packages";
import { requireAdmin } from "../../../../lib/staff";

export const runtime = "nodejs";
const response = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return response(403, { error: "ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ใช้งานได้" });
  try { return response(200, { admins: await listAdmins() }); }
  catch { return response(503, { error: "โหลดรายชื่อผู้ดูแลไม่สำเร็จ" }); }
}

export async function POST(request: Request) {
  if (!validJsonPost(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  // Only an active Admin with a bound LINE identity may add Admins; Customer, Staff and pending Admins are rejected.
  if (!(await requireAdmin(request))) return response(403, { error: "ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ใช้งานได้" });
  let body: unknown;
  try { body = await readBoundedPackageJson(request, 2048); }
  catch (error) { return response(error instanceof PackageRequestTooLargeError ? 413 : 400, { error: "ข้อมูลไม่ถูกต้อง" }); }
  const input = parseAdminInvite(body);
  if (!input) return response(400, { error: "กรอกอีเมลให้ถูกต้องและรหัสผ่านเริ่มต้น 12–128 ตัวอักษร" });
  try {
    const result = await inviteAdmin(input.email, input.password);
    return response(201, result.outcome === "created"
      ? { outcome: "created", message: "เพิ่มผู้ดูแลแล้ว ผู้รับเข้าสู่ระบบด้วยอีเมลและรหัสผ่านเริ่มต้น แล้วยืนยันรับสิทธิ์พร้อมผูก LINE" }
      : { outcome: "existing_user", message: "บัญชีนี้มีอยู่แล้ว ผู้รับใช้รหัสผ่านเดิมเข้าสู่ระบบ แล้วยืนยันรับสิทธิ์พร้อมผูก LINE (รหัสผ่านที่กรอกไม่ถูกใช้)" });
  } catch (error) {
    if (error instanceof AdminInvitationError && error.code === "admin_exists") return response(409, { code: "admin_exists", error: "อีเมลนี้เป็นผู้ดูแลหรือได้รับเชิญเป็นผู้ดูแลอยู่แล้ว" });
    if (error instanceof AdminInvitationError && error.code === "cleanup_failed") return response(503, { cleanup_required: true, error: "เพิ่มผู้ดูแลไม่สำเร็จและล้างบัญชีที่สร้างไว้ไม่สำเร็จ กรุณาติดต่อเจ้าของโครงการ" });
    return response(503, { error: "เพิ่มผู้ดูแลไม่สำเร็จ กรุณาลองใหม่" });
  }
}
