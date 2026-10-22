import Link from "next/link";
import { getAccountFromCookies } from "../../lib/auth";
import { LogoutButton } from "../login/login-form";

export default async function StaffPage() {
  const account = await getAccountFromCookies();
  if (!account || account.role !== "staff" || account.status !== "active") {
    return (
      <main className="page-wrap">
        <section className="protected-card">
          <p className="eyebrow">STAFF</p>
          <h1>พื้นที่ผู้ประกอบการชุมชน</h1>
          <p>บัญชีนี้ยังไม่มีสิทธิ์ Staff ที่อนุมัติแล้ว กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับอนุมัติ</p>
          <Link href="/login" className="button button-primary">ไปหน้าเข้าสู่ระบบ</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap">
      <header className="topbar">
        <Link href="/staff" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน · ผู้ประกอบการ</Link>
        <LogoutButton />
      </header>
      <p className="eyebrow">STAFF WORKSPACE</p>
      <h1>พื้นที่ผู้ประกอบการชุมชน</h1>
      <div className="staff-panel">
        <span className="feature-mark" aria-hidden="true">✓</span>
        <div>
          <h2>บัญชีได้รับอนุมัติแล้ว</h2>
          <p>การจัดการสินค้า บริการ และคำสั่งซื้อยังไม่เปิดใช้งาน</p>
        </div>
      </div>
    </main>
  );
}
