import Link from "next/link";
import { CartForm } from "./cart-form";

export const dynamic = "force-dynamic";

export default function CartPage() {
  return <main className="page-wrap">
    <header className="topbar"><Link href="/products" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> สินค้าชุมชน</Link><Link href="/products" className="top-link">เลือกร้าน</Link></header>
    <h1>ตะกร้าสินค้า</h1><p className="lead">ตะกร้าเก็บข้อมูลเฉพาะบัญชีของคุณ หนึ่งตะกร้ามีสินค้าได้จากร้านเดียว</p>
    <CartForm />
    <nav className="bottom-nav" aria-label="เมนูลูกค้า"><Link href="/">หน้าหลัก</Link><Link href="/my-trip">My Trip</Link><Link href="/my-order">My Order</Link></nav>
  </main>;
}
