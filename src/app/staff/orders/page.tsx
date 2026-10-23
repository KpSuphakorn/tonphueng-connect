import Link from "next/link";
import { getAccountFromCookies } from "../../../lib/auth";
import { listStaffOrders, ORDER_STATUS_LABELS, STAFF_ORDER_STATUSES } from "../../../lib/orders";
import { LogoutButton } from "../../login/login-form";
import { OrderStatusForm } from "./order-status-form";

export const dynamic = "force-dynamic";
const baht = (satang: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(satang / 100);
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value)) : "";

export default async function StaffOrdersPage() {
  const account = await getAccountFromCookies();
  if (!account || account.role !== "staff" || account.status !== "active") return <main className="page-wrap"><section className="protected-card"><h1>คำสั่งซื้อของร้าน</h1><p>บัญชีนี้ยังไม่มีสิทธิ์ Staff ที่อนุมัติแล้ว</p><Link href="/login" className="button button-primary">เข้าสู่ระบบ</Link></section></main>;
  let orders: Awaited<ReturnType<typeof listStaffOrders>> = null;
  let failed = false;
  try { orders = await listStaffOrders(account.id); } catch { failed = true; }
  return <main className="page-wrap">
    <header className="topbar"><Link href="/staff" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน · ผู้ประกอบการ</Link><LogoutButton /></header>
    <h1>คำสั่งซื้อของร้าน</h1>
    <p className="lead">แสดงเฉพาะคำสั่งซื้อของร้านคุณที่ลูกค้าชำระเงินแล้ว อัปเดตสถานะเพื่อให้ลูกค้าติดตามใน My Order</p>
    {failed ? <p className="error-message" role="alert">โหลดคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่</p>
      : orders === null ? <p className="note-card">บัญชีนี้ยังไม่มีร้านประเภทสินค้าชุมชน จึงยังไม่มีคำสั่งซื้อสินค้า</p>
      : !orders.length ? <p className="note-card">ยังไม่มีคำสั่งซื้อที่รอดำเนินการ</p>
      : orders.map((order) => <article className="booking-summary" key={order.id} aria-label={`คำสั่งซื้อ ${order.id.slice(0, 8)}`}>
        <span className="availability">คำสั่งซื้อ #{order.id.slice(0, 8)} · ชำระเงินเมื่อ {dateTime(order.paid_at)}</span>
        <ul className="cart-line-list">{order.items.map((item) => <li key={item.product_id}>
          <span className="cart-line-name"><strong>{item.product_name}</strong><small>{baht(item.unit_price_satang)} × {item.quantity}</small></span>
          <span>จำนวน {item.quantity}</span>
        </li>)}</ul>
        <p><strong>วิธีรับสินค้า:</strong> {order.fulfillment === "delivery" ? "จัดส่ง" : "ลูกค้ารับที่ร้าน"}</p>
        {order.fulfillment === "delivery" && <p><strong>ที่อยู่จัดส่ง:</strong> {order.delivery_address}</p>}
        <p><strong>ยอดรวม:</strong> {baht(order.total_satang)} (สินค้า {baht(order.subtotal_satang)} + ค่าส่ง {baht(order.shipping_satang)})</p>
        <OrderStatusForm order={order} labels={ORDER_STATUS_LABELS} statuses={STAFF_ORDER_STATUSES} />
      </article>)}
    <Link className="back-link" href="/staff">กลับหน้าผู้ประกอบการ</Link>
  </main>;
}
