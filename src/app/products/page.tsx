import Link from "next/link";
import { listProductStores } from "../../lib/products";
import type { ProductStore } from "../../lib/product-types";
import { AppHeader } from "../components/app-header";
import { BottomNav } from "../components/bottom-nav";
import { Icon } from "../components/icons";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let stores: ProductStore[] = [];
  let failed = false;
  try { stores = await listProductStores(); } catch { failed = true; }
  return <main className="page-wrap">
    <AppHeader back={{ href: "/", label: "หน้าหลัก" }}><Link href="/cart" className="top-link"><Icon name="cart" size={18} />ตะกร้า</Link></AppHeader>
    <div className="page-intro"><h1>เลือกร้านสินค้าชุมชน</h1><p className="lead">เลือกหนึ่งร้านเพื่อดูสินค้าที่เปิดจำหน่าย</p></div>
    {failed ? <p className="error-message" role="alert">โหลดร้านค้าไม่สำเร็จ กรุณากลับมาอีกครั้ง</p> : stores.length ? <ul className="store-list">{stores.map((store) => <li key={store.id}>
      <Link href={`/products/${store.id}`}><span className="store-icon"><Icon name="store" /></span><span className="store-copy"><strong>{store.name}</strong><small>{store.address}</small></span><span className="store-count">{store.product_count} สินค้า</span><Icon name="chevronRight" /></Link>
    </li>)}</ul> : <p className="note-card">ยังไม่มีร้านสินค้าชุมชนที่เปิดใช้งาน</p>}
    <BottomNav />
  </main>;
}
