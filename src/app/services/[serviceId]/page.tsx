import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveService } from "../../../lib/services";
import { getAccountFromCookies } from "../../../lib/auth";
import { ServiceDetails } from "../service-details";

export const dynamic = "force-dynamic";

export default async function ServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const service = await getActiveService(serviceId);
  if (!service) notFound();
  const account = await getAccountFromCookies();
  const isCustomer = account?.role === "customer" && account.status === "active";
  return <main className="page-wrap">
    <header className="topbar"><Link href="/services" className="top-link">← กลับไปรายการบริการ</Link><Link href="/my-trip" className="top-link">My Trip</Link></header>
    <ServiceDetails service={service} canSave={isCustomer} />
    <nav className="bottom-nav" aria-label="เมนูลูกค้า"><Link href="/">หน้าหลัก</Link><Link href="/my-trip">My Trip</Link><Link href="/my-order">My Order</Link></nav>
  </main>;
}
