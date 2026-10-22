import Link from "next/link";
import { ServiceBrowser } from "./service-browser";

export default function ServicesPage() {
  return (
    <main className="page-wrap">
      <header className="topbar"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน</Link><Link href="/my-trip" className="top-link">My Trip</Link></header>
      <p className="eyebrow">DISCOVER TONPHUENG</p>
      <h1>บริการของชุมชน</h1>
      <p className="lead">เลือกดูสถานที่และบริการที่ผู้ประกอบการซึ่งได้รับอนุมัติเพิ่มไว้</p>
      <ServiceBrowser />
      <nav className="bottom-nav" aria-label="เมนูลูกค้า"><Link href="/">หน้าหลัก</Link><Link href="/my-trip">My Trip</Link><Link href="/my-order">My Order</Link></nav>
    </main>
  );
}
