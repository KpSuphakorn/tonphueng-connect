import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveService } from "../../../lib/services";
import { getAccountFromCookies } from "../../../lib/auth";
import { ServiceDetails } from "../service-details";
import { AppHeader } from "../../components/app-header";
import { BottomNav } from "../../components/bottom-nav";

export const dynamic = "force-dynamic";

export default async function ServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const service = await getActiveService(serviceId);
  if (!service) notFound();
  const account = await getAccountFromCookies();
  const isCustomer = account?.role === "customer" && account.status === "active";
  return <main className="page-wrap">
    <AppHeader back={{ href: "/services", label: "รายการบริการ" }}><Link href="/my-trip" className="top-link">My Trip</Link></AppHeader>
    <ServiceDetails service={service} canSave={isCustomer} />
    <BottomNav />
  </main>;
}
