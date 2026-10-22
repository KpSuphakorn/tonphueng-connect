import Link from "next/link";
import { getAccountFromCookies } from "../../lib/auth";

export default async function MyTripPage() {
  const account = await getAccountFromCookies();
  const isCustomer = account?.role === "customer" && account.status === "active";
  return (
    <main className="page-wrap">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน</Link>
        {!isCustomer && <Link href="/login" className="top-link">เข้าสู่ระบบ</Link>}
      </header>
      <p className="eyebrow">MY TRIP</p>
      <h1>My Trip</h1>
      <section className="section note-card" aria-live="polite">
        {isCustomer ? (
          <><strong>ยังไม่มีสถานที่หรือทริปที่บันทึกไว้</strong><p style={{ margin: "6px 0 0" }}>เมื่อคุณบันทึกสถานที่หรือจองแพ็กเกจ รายการจะแสดงที่นี่</p></>
        ) : (
          <><strong>เข้าสู่ระบบด้วย LINE เพื่อดู My Trip</strong><p style={{ margin: "6px 0 0" }}>รายการจะแสดงเฉพาะบัญชีลูกค้าของคุณ</p><Link href="/login" className="button button-primary" style={{ marginTop: 14 }}>เข้าสู่ระบบ</Link></>
        )}
      </section>
      <nav className="bottom-nav" aria-label="เมนูลูกค้า">
        <Link href="/">หน้าหลัก</Link><Link href="/my-trip" aria-current="page">My Trip</Link><Link href="/my-order">My Order</Link>
      </nav>
    </main>
  );
}
