import Link from "next/link";
import { getAccountFromCookies } from "../../../lib/auth";
import { listPackageBookings } from "../../../lib/packages";

export const dynamic = "force-dynamic";
const baht = (satang: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(satang / 100);

export default async function AdminBookingsPage() {
  const account = await getAccountFromCookies();
  if (!account || account.role !== "admin" || account.status !== "active") return <main className="page-wrap"><section className="protected-card"><h1>รายการจอง</h1><p>กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ใช้งานได้</p><Link className="button button-primary" href="/login">เข้าสู่ระบบ</Link></section></main>;
  let bookings;
  try { bookings = await listPackageBookings(); }
  catch { return <main className="page-wrap"><p className="error-message">โหลดรายการจองไม่สำเร็จ</p></main>; }
  return <main className="page-wrap"><header className="topbar"><Link href="/admin" className="top-link">← ผู้ดูแล</Link><Link href="/" className="brand">ผึ้งพาเดิน · รายการจอง</Link></header>
    <p className="eyebrow">ADMIN · BOOKED PACKAGES</p><h1>รายการจองแพ็กเกจ</h1>
    {!bookings.length ? <section className="note-card">ยังไม่มีการจอง</section> : bookings.map((booking) => {
      const snapshot = booking.package_snapshot as { sub_package_title?: string; package_title?: string };
      return <article className="booking-summary" key={booking.id}>
        <span className="availability">{booking.status === "paid_simulated" ? "จ่ายจำลองแล้ว" : "รอยืนยัน"} · {booking.start_date} – {booking.end_date}</span>
        <h2>{snapshot.sub_package_title || "Sub Package"}</h2><p>{snapshot.package_title} · {booking.participants} คน · {baht(booking.total_price_satang)}</p>
        <Link className="text-link" href={`/bookings/${booking.id}`}>ดูรายละเอียดและตัวเลือกที่บันทึกไว้</Link>
      </article>;
    })}
  </main>;
}
