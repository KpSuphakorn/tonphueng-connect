import Link from "next/link";
import { getAccountFromCookies } from "../../lib/auth";

export default async function MyOrderPage() {
  const account = await getAccountFromCookies();
  const isCustomer = account?.role === "customer" && account.status === "active";
  return (
    <main className="page-wrap">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน</Link>
        {!isCustomer && <Link href="/login" className="top-link">เข้าสู่ระบบ</Link>}
      </header>
      <p className="eyebrow">MY ORDER</p>
      <h1>My Order</h1>
      <section className="section note-card" aria-live="polite">
        {isCustomer ? (
          <><strong>การชำระเงินและคำสั่งซื้อยังไม่เปิด</strong><p style={{ margin: "6px 0 0" }}>คุณจัดตะกร้าและเลือกวิธีรับสินค้าได้ก่อน เมื่อระบบคำสั่งซื้อพร้อม รายการจะแสดงที่นี่</p><Link href="/cart" className="button button-primary" style={{ marginTop: 14 }}>เปิดตะกร้า</Link></>
        ) : (
          <><strong>เข้าสู่ระบบด้วย LINE เพื่อดู My Order</strong><p style={{ margin: "6px 0 0" }}>คำสั่งซื้อจะแสดงเฉพาะบัญชีลูกค้าของคุณ</p><Link href="/login" className="button button-primary" style={{ marginTop: 14 }}>เข้าสู่ระบบ</Link></>
        )}
      </section>
      <nav className="bottom-nav" aria-label="เมนูลูกค้า">
        <Link href="/">หน้าหลัก</Link><Link href="/my-trip">My Trip</Link><Link href="/my-order" aria-current="page">My Order</Link>
      </nav>
    </main>
  );
}
