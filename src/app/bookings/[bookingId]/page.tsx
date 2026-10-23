import { notFound } from "next/navigation";
import { getAccountFromCookies } from "../../../lib/auth";
import { getPackageBooking } from "../../../lib/packages";
import { BookingPayment } from "./booking-payment";

import { AppHeader } from "../../components/app-header";
import { BottomNav } from "../../components/bottom-nav";
import { Icon } from "../../components/icons";

export const dynamic = "force-dynamic";
const baht = (satang: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(satang / 100);

export default async function BookingPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) notFound();
  const account = await getAccountFromCookies();
  if (!account || account.status !== "active" || !["customer", "admin"].includes(account.role)) notFound();
  let booking;
  try { booking = await getPackageBooking(bookingId, account.role === "customer" ? account.id : undefined); }
  catch { return <main className="page-wrap no-nav"><AppHeader /><p className="error-message" role="alert">โหลดรายการจองไม่สำเร็จ</p></main>; }
  if (!booking) notFound();
  const snapshot = booking.package_snapshot as { package_title?: string; sub_package_title?: string; duration_days?: number; choices?: Array<{ slot_name?: string; service?: { name?: string; address?: string } }> };
  const isCustomer = account.role === "customer";
  const paid = booking.status === "paid_simulated";
  return <main className={isCustomer ? "page-wrap" : "page-wrap no-nav"}>
    <AppHeader back={isCustomer ? { href: "/my-trip", label: "My Trip" } : { href: "/admin/bookings", label: "รายการจอง" }} />
    <div className="page-intro">
      <span className={`status-badge ${paid ? "status-delivered" : "status-pending"}`}>{paid ? "ชำระเงินแล้ว" : "รอยืนยัน"}</span>
      <h1>{snapshot.sub_package_title || "แพ็กเกจ"}</h1>
      <p className="lead">{snapshot.package_title} · รายการจองเก็บข้อมูลแพ็กเกจและบริการ ณ วันที่สร้าง</p>
    </div>
    <section className="booking-summary" aria-labelledby="booking-summary-heading">
      <h2 id="booking-summary-heading" className="visually-hidden">สรุปรายการจอง</h2>
      <div className="summary-rows">
        <p><strong>วันเริ่มทริป</strong> <span>{booking.start_date}</span></p>
        <p><strong>วันสิ้นสุด</strong> <span>{booking.end_date} ({snapshot.duration_days ?? 1} วัน)</span></p>
        <p><strong>ผู้เข้าร่วม</strong> <span>{booking.participants} คน</span></p>
        <p><strong>ราคาต่อคน</strong> <span>{baht(booking.price_per_person_satang)}</span></p>
        <p className="summary-total"><strong>ยอดรวมจากระบบ</strong> <span>{baht(booking.total_price_satang)}</span></p>
      </div>
      <h2>ตัวเลือกที่จอง</h2>
      <ul className="place-list">{(snapshot.choices ?? []).map((choice, index) => <li key={`${choice.slot_name}-${index}`}><Icon name="pin" size={18} /><span><strong>{choice.slot_name}:</strong> {choice.service?.name}<small>{choice.service?.address}</small></span></li>)}</ul>
    </section>
    {isCustomer && <BookingPayment booking={booking} />}
    {isCustomer && <BottomNav />}
  </main>;
}
