import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccountFromCookies } from "../../../lib/auth";
import { getCustomerOrder, ORDER_STATUSES, type ProductOrder } from "../../../lib/orders";
import { isProductId } from "../../../lib/products";
import { OrderPayment } from "./order-payment";

export const dynamic = "force-dynamic";
const baht = (satang: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(satang / 100);
/** Display steps follow the stored statuses in order; pickup wording changes only the labels. */
function steps(order: ProductOrder) {
  const pickup = order.fulfillment === "pickup";
  return ["รอชำระ", "ชำระแล้ว", "ร้านกำลังเตรียม", pickup ? "พร้อมรับที่ร้าน" : "กำลังจัดส่ง", pickup ? "รับสินค้าเรียบร้อย" : "ส่งเรียบร้อย"];
}

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!isProductId(orderId)) notFound();
  const account = await getAccountFromCookies();
  if (!account || account.role !== "customer" || account.status !== "active") notFound();
  let order;
  try { order = await getCustomerOrder(account.id, orderId); }
  catch { return <main className="page-wrap"><p className="error-message" role="alert">โหลดคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่</p></main>; }
  if (!order) notFound();
  return <main className="page-wrap">
    <header className="topbar"><Link href="/my-order" className="top-link">← My Order</Link><Link href="/" className="brand">ผึ้งพาเดิน · คำสั่งซื้อ</Link></header>
    <p className="eyebrow">ORDER #{order.id.slice(0, 8)}</p>
    <h1>{order.store_name}</h1>
    {order.payment_status === "paid_simulated" && <p><span className="status-badge status-paid-demo">ชำระเงินแล้ว</span></p>}
    <ol className="order-steps" aria-label="สถานะคำสั่งซื้อ">{steps(order).map((label, index) => {
      const current = ORDER_STATUSES.indexOf(order.status);
      return <li key={label} className={index < current ? "done" : index === current ? "current" : undefined} aria-current={index === current ? "step" : undefined}>{label}</li>;
    })}</ol>
    <p className="lead">รายการ ราคา และค่าส่งคำนวณใหม่บน server จากสินค้าที่เปิดขายตอนสร้างคำสั่งซื้อ และบันทึกไว้ไม่เปลี่ยนตามราคาสินค้าภายหลัง</p>
    <section className="booking-summary" aria-labelledby="order-items-heading">
      <h2 id="order-items-heading">รายการสินค้า</h2>
      <ul className="cart-line-list">{order.items.map((item) => <li key={item.product_id}>
        <span className="cart-line-name"><strong>{item.product_name}</strong><small>{baht(item.unit_price_satang)} × {item.quantity}</small></span>
        <span>{baht(item.line_total_satang)}</span>
      </li>)}</ul>
      <p><strong>วิธีรับสินค้า:</strong> {order.fulfillment === "delivery" ? "จัดส่ง" : "รับที่ร้าน"}</p>
      {order.fulfillment === "delivery" && <p><strong>ที่อยู่จัดส่ง:</strong> {order.delivery_address}</p>}
      <dl className="cart-total-list"><div><dt>ราคาสินค้า</dt><dd>{baht(order.subtotal_satang)}</dd></div><div><dt>ค่าส่ง</dt><dd>{baht(order.shipping_satang)}{order.fulfillment === "delivery" && <small> ค่าส่งคงที่</small>}</dd></div><div className="cart-grand-total"><dt>ยอดรวมจากระบบ</dt><dd>{baht(order.total_satang)}</dd></div></dl>
      {order.fulfillment === "delivery" && <p><strong>เลขพัสดุ:</strong> {order.tracking_number ?? "ร้านยังไม่ได้กรอก"}</p>}
    </section>
    <OrderPayment order={order} />
    <nav className="bottom-nav" aria-label="เมนูลูกค้า"><Link href="/">หน้าหลัก</Link><Link href="/my-trip">My Trip</Link><Link href="/my-order" aria-current="page">My Order</Link></nav>
  </main>;
}
