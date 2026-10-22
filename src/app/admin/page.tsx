import Link from "next/link";
import { getAccountFromCookies } from "../../lib/auth";
import { LogoutButton } from "../login/login-form";

export default async function AdminPage() {
  const account = await getAccountFromCookies();
  if (!account || account.role !== "admin" || account.status !== "active") {
    return (
      <main className="page-wrap">
        <section className="protected-card">
          <p className="eyebrow">ADMIN</p>
          <h1>พื้นที่ผู้ดูแลโครงการ</h1>
          <p>กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่เจ้าของโครงการตั้งค่าไว้</p>
          <Link href="/login" className="button button-primary">ไปหน้าเข้าสู่ระบบ</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap">
      <header className="topbar">
        <Link href="/admin" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน · ผู้ดูแล</Link>
        <LogoutButton />
      </header>
      <p className="eyebrow">ADMIN WORKSPACE</p>
      <h1>พื้นที่ผู้ดูแลโครงการ</h1>
      <section className="section note-card">
        <strong>บัญชีผู้ดูแลเริ่มต้นพร้อมแล้ว</strong>
        <p style={{ margin: "6px 0 0" }}>การอนุมัติผู้ประกอบการ การดูการจอง และการเพิ่มผู้ดูแลยังไม่เปิดใช้งาน</p>
      </section>
    </main>
  );
}
