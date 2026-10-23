import Link from "next/link";
import { getAccountFromCookies } from "../../../lib/auth";
import { listAdmins, type AdminListItem } from "../../../lib/admin-invitations";
import { LogoutButton } from "../../login/login-form";
import { AddAdminForm } from "./add-admin-form";
import { AppHeader } from "../../components/app-header";

export const dynamic = "force-dynamic";
const STATUS_LABELS: Record<AdminListItem["status"], string> = { active: "ใช้งานแล้ว (ผูก LINE แล้ว)", pending: "รอยืนยันรับสิทธิ์และผูก LINE", disabled: "ปิดใช้งาน" };

export default async function AdminAdminsPage() {
  const account = await getAccountFromCookies();
  if (!account || account.role !== "admin" || account.status !== "active") {
    return <main className="page-wrap no-nav"><section className="protected-card"><h1>จัดการผู้ดูแล</h1><p>กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ใช้งานได้</p><Link href="/login" className="button button-primary">ไปหน้าเข้าสู่ระบบ</Link></section></main>;
  }
  let admins: AdminListItem[] = [];
  let failed = false;
  try { admins = await listAdmins(); } catch { failed = true; }
  return <main className="page-wrap no-nav">
    <AppHeader brandHref="/admin" area="ผู้ดูแลโครงการ"><LogoutButton /></AppHeader>
    <h1>จัดการผู้ดูแล</h1>
    <p className="lead">เพิ่มผู้ดูแลด้วยอีเมลและรหัสผ่านเริ่มต้น ผู้รับต้องเข้าสู่ระบบ ยืนยันรับสิทธิ์ และผูกบัญชี LINE ของตนก่อนใช้สิทธิ์ผู้ดูแล</p>
    <section className="panel"><AddAdminForm /></section>
    <section className="section" aria-labelledby="admin-list-heading">
      <h2 id="admin-list-heading">ผู้ดูแลทั้งหมด</h2>
      {failed ? <p className="error-message" role="alert">โหลดรายชื่อผู้ดูแลไม่สำเร็จ กรุณาลองใหม่</p>
        : <ul className="cart-line-list">{admins.map((admin) => <li key={admin.id}><span className="cart-line-name"><strong>{admin.email}</strong><small>{STATUS_LABELS[admin.status]}</small></span></li>)}</ul>}
    </section>
    <Link className="back-link" href="/admin">กลับพื้นที่ผู้ดูแล</Link>
  </main>;
}
