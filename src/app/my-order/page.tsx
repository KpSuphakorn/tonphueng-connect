import Link from "next/link";
import { getAccountFromCookies } from "../../lib/auth";
import { listCustomerOrders, type OrderStatus, type ProductOrder } from "../../lib/orders";

import { AppHeader } from "../components/app-header";
import { BottomNav } from "../components/bottom-nav";
import { Icon } from "../components/icons";

export const dynamic = "force-dynamic";
const baht = (satang: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(satang / 100);
const TABS = [
  { id: "all", label: "ทั้งหมด", statuses: ["pending_payment", "paid", "preparing", "shipping", "delivered"] },
  { id: "to-pay", label: "ที่ต้องชำระ", statuses: ["pending_payment"] },
  { id: "preparing", label: "ร้านกำลังเตรียม", statuses: ["paid", "preparing"] },
  { id: "shipping", label: "กำลังจัดส่ง", statuses: ["shipping"] },
  { id: "done", label: "สำเร็จ", statuses: ["delivered"] },
] as const satisfies ReadonlyArray<{ id: string; label: string; statuses: readonly OrderStatus[] }>;

/** Customer-facing badge; pickup Orders read as "ready for pickup" instead of "shipping" without changing stored values. */
function badge(order: ProductOrder) {
  const pickup = order.fulfillment === "pickup";
  return {
    pending_payment: "รอชำระเงิน",
    paid: "รอร้านรับออเดอร์",
    preparing: "ร้านกำลังเตรียมของ",
    shipping: pickup ? "พร้อมรับที่ร้าน" : "กำลังจัดส่ง",
    delivered: pickup ? "รับสินค้าเรียบร้อย" : "ส่งของเรียบร้อยแล้ว",
  }[order.status];
}

export default async function MyOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await getAccountFromCookies();
  const isCustomer = account?.role === "customer" && account.status === "active";
  const requested = (await searchParams).tab;
  const tab = TABS.find((item) => item.id === requested) ?? TABS[0];
  let orders: ProductOrder[] = [];
  let failed = false;
  if (isCustomer) try { orders = await listCustomerOrders(account.id); } catch { failed = true; }
  const shown = orders.filter((order) => (tab.statuses as readonly OrderStatus[]).includes(order.status));
  return (
    <main className="page-wrap">
      <AppHeader>{isCustomer ? <Link href="/cart" className="top-link"><Icon name="cart" size={18} />ตะกร้า</Link> : <Link href="/login" className="top-link">เข้าสู่ระบบ</Link>}</AppHeader>
      <h1>My Order</h1>
      {!isCustomer ? (
        <section className="section note-card"><strong>เข้าสู่ระบบด้วย LINE เพื่อดู My Order</strong><p>คำสั่งซื้อจะแสดงเฉพาะบัญชีลูกค้าของคุณ</p><Link href="/login" className="button button-primary">เข้าสู่ระบบ</Link></section>
      ) : failed ? (
        <p className="error-message" role="alert">โหลดคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่</p>
      ) : (
        <>
          <nav className="order-tabs" aria-label="สถานะคำสั่งซื้อ">
            {TABS.map((item) => {
              const count = orders.filter((order) => (item.statuses as readonly OrderStatus[]).includes(order.status)).length;
              return <Link key={item.id} href={item.id === "all" ? "/my-order" : `/my-order?tab=${item.id}`} aria-current={item.id === tab.id ? "page" : undefined}>{item.label}{count ? ` (${count})` : ""}</Link>;
            })}
          </nav>
          {!shown.length ? (
            <section className="note-card"><strong>{orders.length ? `ไม่มีคำสั่งซื้อในแท็บ “${tab.label}”` : "ยังไม่มีคำสั่งซื้อ"}</strong><p>เลือกสินค้าชุมชนลงตะกร้า แล้วสั่งซื้อและชำระเงินได้</p><Link href="/products" className="button button-primary">เลือกร้านสินค้า</Link></section>
          ) : (
            <section className="order-list" aria-label={`คำสั่งซื้อ: ${tab.label}`}>
              {shown.map((order) => <article className="booking-summary" key={order.id}>
                <p className="order-card-head"><span className={`status-badge status-${order.status}`}>{badge(order)}</span>{order.payment_status === "paid_simulated" && <span className="status-badge status-paid-demo">ชำระเงินแล้ว</span>}</p>
                <h2 className="order-card-title">{order.store_name}</h2>
                <p className="order-card-items">{order.items.map((item) => `${item.product_name} × ${item.quantity}`).join(", ")}</p>
                {order.tracking_number && <p className="meta-line">เลขพัสดุ: <strong>{order.tracking_number}</strong></p>}
                <div className="order-card-foot">
                  <p><span className="order-total">{baht(order.total_satang)}</span> <span className="form-help">· {order.fulfillment === "delivery" ? "จัดส่ง" : "รับที่ร้าน"}</span></p>
                  {order.payment_status === "pending_simulated"
                    ? <Link className="button button-primary" href={`/orders/${order.id}`}>ไปชำระเงิน</Link>
                    : <Link className="text-link" href={`/orders/${order.id}`}>ดูรายละเอียดคำสั่งซื้อ</Link>}
                </div>
              </article>)}
            </section>
          )}
        </>
      )}
      <BottomNav current="order" />
    </main>
  );
}
