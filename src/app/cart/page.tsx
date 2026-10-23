import { AppHeader } from "../components/app-header";
import { BottomNav } from "../components/bottom-nav";
import { CartForm } from "./cart-form";

export const dynamic = "force-dynamic";

export default function CartPage() {
  return <main className="page-wrap">
    <AppHeader back={{ href: "/products", label: "เลือกร้าน" }} />
    <div className="page-intro"><h1>ตะกร้าสินค้า</h1><p className="lead">ตะกร้าเก็บข้อมูลเฉพาะบัญชีของคุณ หนึ่งตะกร้ามีสินค้าได้จากร้านเดียว</p></div>
    <CartForm />
    <BottomNav />
  </main>;
}
