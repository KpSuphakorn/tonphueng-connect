import Link from "next/link";
import type { Booking } from "../../lib/packages";
import { Icon } from "../components/icons";

type Place = { booking_id: string; service_id: string; service_snapshot: { name?: string; address?: string; category?: string } };

export function BookedTrips({ bookings, places }: { bookings: Booking[]; places: Place[] }) {
  return <section className="section" aria-labelledby="booked-trips-heading">
    <div className="section-heading"><h2 id="booked-trips-heading">ทริปที่จองแล้ว</h2><p>สถานที่จากการจอง</p></div>
    {!bookings.length ? <section className="note-card"><p>ยังไม่มีรายการจองที่เพิ่มสถานที่เข้า My Trip</p><Link className="text-link" href="/packages">เลือกดูแพ็กเกจ</Link></section> : bookings.map((booking) => {
      const snapshot = booking.package_snapshot as { sub_package_title?: string };
      const selected = places.filter((place) => place.booking_id === booking.id);
      return <article className="booking-summary" key={booking.id}>
        <p className="order-card-head"><span className={`status-badge ${booking.status === "paid_simulated" ? "status-delivered" : "status-pending"}`}>{booking.status === "paid_simulated" ? "ชำระเงินแล้ว" : "รอชำระเงิน"}</span><span className="availability">{booking.start_date} – {booking.end_date}</span></p>
        <h3>{snapshot.sub_package_title || "แพ็กเกจ"}</h3>
        {booking.my_trip_added_at ? <ul className="place-list">{selected.map((place) => <li key={`${booking.id}-${place.service_id}`}><Icon name="pin" size={18} /><span><strong>{place.service_snapshot.name}</strong><small>{place.service_snapshot.address}</small></span></li>)}</ul>
          : <p>{booking.status === "paid_simulated" ? "ยังไม่ได้เพิ่มสถานที่เข้า My Trip" : "เปิดรายการเพื่อทบทวนราคาและชำระเงิน"}</p>}
        <Link className="text-link" href={`/bookings/${booking.id}`}>ดูรายละเอียดการจอง</Link>
      </article>;
    })}
  </section>;
}
