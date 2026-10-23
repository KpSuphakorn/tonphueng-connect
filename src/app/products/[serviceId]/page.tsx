import Link from "next/link";
import { listProductStores, listProductsForStore } from "../../../lib/products";
import type { Product, ProductStore } from "../../../lib/product-types";
import { ProductList } from "../product-list";
import { AppHeader } from "../../components/app-header";
import { BottomNav } from "../../components/bottom-nav";
import { Icon } from "../../components/icons";

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
    <AppHeader back={{ href: "/products", label: "ร้านสินค้าชุมชน" }}><Link href="/cart" className="top-link"><Icon name="cart" size={18} />ตะกร้า</Link></AppHeader>
    {store ? <><div className="page-intro"><h1>{store.name}</h1><p className="meta-line"><Icon name="pin" size={18} />{store.address}</p></div>{failed ? <p className="error-message" role="alert">โหลดสินค้าไม่สำเร็จ กรุณากลับมาอีกครั้ง</p> : <ProductList serviceId={serviceId} storeName={store.name} products={products} />}</> : <section className="note-card" role={failed ? "alert" : undefined}>{failed ? "โหลดร้านค้าไม่สำเร็จ กรุณากลับมาอีกครั้ง" : "ไม่พบร้านสินค้าชุมชนที่เปิดใช้งาน"}<p><Link className="text-link" href="/products">เลือกร้านอื่น</Link></p></section>}
    <BottomNav />
  </main>;
}
