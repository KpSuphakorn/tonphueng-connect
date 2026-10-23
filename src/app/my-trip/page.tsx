import Link from "next/link";
import { getAccountFromCookies } from "../../lib/auth";
import { getSavedServices } from "../../lib/services";
import { getMyTripBookingServices, listPackageBookings } from "../../lib/packages";
import { BookedTrips } from "./booked-trips";
import { MyTripList } from "./my-trip-list";
import { AppHeader } from "../components/app-header";
import { BottomNav } from "../components/bottom-nav";

export default async function MyTripPage() {
  const account = await getAccountFromCookies();
  const isCustomer = account?.role === "customer" && account.status === "active";
  const services = isCustomer ? await getSavedServices(account.id) : [];
  const [bookings, bookedPlaces] = isCustomer ? await Promise.all([listPackageBookings(account.id), getMyTripBookingServices(account.id)]) : [[], []];
  return (
    <main className="page-wrap">
      <AppHeader>{!isCustomer && <Link href="/login" className="top-link">เข้าสู่ระบบ</Link>}</AppHeader>
      <h1>My Trip</h1>
      {isCustomer ? (
        <>
          <BookedTrips bookings={bookings} places={bookedPlaces} />
          <MyTripList initialServices={services} />
        </>
        ) : (
          <section className="section note-card"><strong>เข้าสู่ระบบด้วย LINE เพื่อดู My Trip</strong><p>รายการจะแสดงเฉพาะบัญชีลูกค้าของคุณ</p><Link href="/login" className="button button-primary">เข้าสู่ระบบ</Link></section>
      )}
      <BottomNav current="trip" />
    </main>
  );
}
