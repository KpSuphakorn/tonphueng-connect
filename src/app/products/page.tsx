import Link from "next/link";
import { listProductStores } from "../../lib/products";
import type { ProductStore } from "../../lib/product-types";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let stores: ProductStore[] = [];
  let failed = false;
  try { stores = await listProductStores(); } catch { failed = true; }
  return <main className="page-wrap">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน · สินค้าชุมชน</Link><Link href="/cart" className="top-link">ตะกร้า</Link></header>
    <h1>เลือกร้านสินค้าชุมชน</h1><p className="lead">เลือกหนึ่งร้านเพื่อดูสินค้าที่เปิดจำหน่าย</p>
    {failed ? <p className="error-message" role="alert">โหลดร้านค้าไม่สำเร็จ กรุณากลับมาอีกครั้ง</p> : stores.length ? <ul className="store-list">{stores.map((store) => <li key={store.id}>
      <Link href={`/products/${store.id}`}><span><strong>{store.name}</strong><small>{store.address}</small></span><span className="store-count">{store.product_count} สินค้า</span></Link>
    </li>)}</ul> : <p className="note-card">ยังไม่มีร้านสินค้าชุมชนที่เปิดใช้งาน</p>}
    <nav className="bottom-nav" aria-label="เมนูลูกค้า"><Link href="/" >หน้าหลัก</Link><Link href="/my-trip">My Trip</Link><Link href="/my-order">My Order</Link></nav>
  </main>;
}
