import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccountFromCookies } from "../../../lib/auth";
import { getPackageBooking } from "../../../lib/packages";
import { BookingPayment } from "./booking-payment";

export const dynamic = "force-dynamic";
const baht = (satang: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(satang / 100);

export default async function BookingPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) notFound();
  const account = await getAccountFromCookies();
  if (!account || account.status !== "active" || !["customer", "admin"].includes(account.role)) notFound();
  let booking;
  try { booking = await getPackageBooking(bookingId, account.role === "customer" ? account.id : undefined); }
  catch { return <main className="page-wrap"><p className="error-message">โหลดรายการจองไม่สำเร็จ</p></main>; }
  if (!booking) notFound();
  const snapshot = booking.package_snapshot as { package_title?: string; sub_package_title?: string; duration_days?: number; choices?: Array<{ slot_name?: string; service?: { name?: string; address?: string } }> };
  return <main className="page-wrap">
    <header className="topbar"><Link href={account.role === "admin" ? "/admin/bookings" : "/my-trip"} className="top-link">← กลับ</Link><Link href="/" className="brand">ผึ้งพาเดิน · รายละเอียดการจอง</Link></header>
    <p className="eyebrow">BOOKING · {booking.status === "paid_simulated" ? "จ่ายจำลองแล้ว" : "รอยืนยัน"}</p>
    <h1>{snapshot.sub_package_title || "Sub Package"}</h1><p className="lead">{snapshot.package_title} · รายการจองเก็บข้อมูลแพ็กเกจและบริการ ณ วันที่สร้าง</p>
    <section className="booking-summary">
      <p><strong>วันเริ่มทริป:</strong> {booking.start_date} · <strong>วันสิ้นสุด:</strong> {booking.end_date} ({snapshot.duration_days ?? 1} วัน)</p>
      <p><strong>ผู้เข้าร่วม:</strong> {booking.participants} คน</p>
      <p><strong>ราคาต่อคน:</strong> {baht(booking.price_per_person_satang)}</p>
      <p><strong>ยอดรวมจากระบบ:</strong> {baht(booking.total_price_satang)}</p>
      <h2>ตัวเลือกที่จอง</h2>
      <ul>{(snapshot.choices ?? []).map((choice, index) => <li key={`${choice.slot_name}-${index}`}><strong>{choice.slot_name}:</strong> {choice.service?.name} — {choice.service?.address}</li>)}</ul>
    </section>
    {account.role === "customer" && <BookingPayment booking={booking} />}
  </main>;
}
