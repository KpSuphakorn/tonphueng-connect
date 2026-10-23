import Link from "next/link";
import { listProductStores, listProductsForStore } from "../../../lib/products";
import type { Product, ProductStore } from "../../../lib/product-types";
import { ProductList } from "../product-list";

export const dynamic = "force-dynamic";

export default async function ProductStorePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  let store: ProductStore | undefined;
  let products: Product[] = [];
  let failed = false;
  try {
    store = (await listProductStores()).find((item) => item.id === serviceId);
    if (store) products = await listProductsForStore(serviceId) ?? [];
  } catch { failed = true; }
  return <main className="page-wrap">
    <header className="topbar"><Link href="/products" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ร้านสินค้าชุมชน</Link><Link href="/cart" className="top-link">ตะกร้า</Link></header>
    {store ? <><h1>{store.name}</h1><p className="lead">{store.address}</p>{failed ? <p className="error-message" role="alert">โหลดสินค้าไม่สำเร็จ กรุณากลับมาอีกครั้ง</p> : <ProductList serviceId={serviceId} storeName={store.name} products={products} />}</> : <section className="note-card" role={failed ? "alert" : undefined}>{failed ? "โหลดร้านค้าไม่สำเร็จ กรุณากลับมาอีกครั้ง" : "ไม่พบร้านสินค้าชุมชนที่เปิดใช้งาน"}<p><Link className="text-link" href="/products">เลือกร้านอื่น</Link></p></section>}
    <nav className="bottom-nav" aria-label="เมนูลูกค้า"><Link href="/">หน้าหลัก</Link><Link href="/my-trip">My Trip</Link><Link href="/my-order">My Order</Link></nav>
  </main>;
}
