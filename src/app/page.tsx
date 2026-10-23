import Link from "next/link";
import { getAccountFromCookies } from "../lib/auth";
import { LogoutButton } from "./login/login-form";

const offers = [
  {
    href: "/packages",
    title: "แพ็กเกจชุมชน",
    description: "เลือกประสบการณ์และเส้นทางเรียนรู้ของบ้านต้นผึ้ง",
    action: "ดูแพ็กเกจ",
  },
  {
    href: "/products",
    title: "สินค้าชุมชน",
    description: "เลือกหนึ่งร้านเพื่อดูสินค้าและจัดตะกร้า",
    action: "เลือกร้านสินค้า",
  },
  {
    href: "/services",
    title: "บริการของเรา",
    description: "สำรวจที่พัก ร้านอาหาร และบริการท่องเที่ยว",
    action: "เลือกดูบริการ",
  },
];

export default async function HomePage() {
  const account = await getAccountFromCookies();
  const isCustomer = account?.role === "customer" && account.status === "active";

  return (
    <main className="page-wrap">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">ผ</span>
          <span>ผึ้งพาเดิน <span style={{ color: "var(--muted)", fontWeight: 500 }}>บ้านต้นผึ้ง</span></span>
        </Link>
        {isCustomer ? <LogoutButton /> : <Link className="top-link" href="/login">เข้าสู่ระบบ</Link>}
      </header>

      <section className="hero">
        <div className="hero-content">
          <p className="welcome-note">เที่ยวชุมชนบ้านต้นผึ้ง จ.เชียงใหม่</p>
          <h1>รู้จักบ้านต้นผึ้ง<br />ผ่านประสบการณ์ของชุมชน</h1>
          <p className="lead">เลือกชมสินค้าและบริการ วางแผนทริป และติดตามรายการของคุณได้จากที่เดียว</p>
          {!isCustomer && <Link href="/login" className="button button-primary">เริ่มต้นใช้งาน</Link>}
        </div>
      </section>

      <section className="section" aria-labelledby="discover-heading">
        <div className="section-heading">
          <div>
            <h2 id="discover-heading">มีอะไรให้เลือกบ้าง</h2>
          </div>
          <p>ข้อมูลจะแสดงเมื่อผู้ดูแลและผู้ประกอบการเพิ่มรายการ</p>
        </div>
        <div className="cards">
          {offers.map((offer) => offer.href ? (
            <Link className="feature-card feature-card-link" href={offer.href} key={offer.title}>
              <span className="feature-card-copy"><span className="feature-card-title">{offer.title}</span><span>{offer.description}</span><span className="availability">{offer.action}</span></span>
            </Link>
          ) : (
            <details className="feature-card" key={offer.title}>
              <summary>
                <span className="feature-card-copy">
                  <span className="feature-card-title">{offer.title}</span>
                  <span>{offer.description}</span>
                  <span className="availability">ยังไม่เปิดให้ใช้งาน</span>
                </span>
              </summary>
              <p className="empty-detail">ยังไม่มีข้อมูลให้เลือกในขณะนี้ โปรดกลับมาตรวจสอบภายหลัง</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section note-card" aria-label="ข้อมูล My Trip">
        <strong>ทริปและรายการของคุณ</strong>
        <p style={{ margin: "6px 0 0" }}>{isCustomer ? "เปิด My Trip เพื่อดูสถานที่และตัวเลือกแพ็กเกจที่บันทึกไว้ ส่วน My Order จะแสดงคำสั่งซื้อเมื่อเปิดใช้งาน" : "เข้าสู่ระบบด้วย LINE เพื่อดู My Trip และ My Order ของบัญชีคุณ"}</p>
      </section>

      <p style={{ margin: "24px 0 0", color: "var(--muted)", fontSize: 13 }}><Link href="/credits" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>เครดิตภาพ</Link></p>

      <nav className="bottom-nav" aria-label="เมนูลูกค้า">
        <Link href="/" aria-current="page">หน้าหลัก</Link>
        <Link href="/my-trip">My Trip</Link>
        <Link href="/my-order">My Order</Link>
      </nav>
    </main>
  );
}
