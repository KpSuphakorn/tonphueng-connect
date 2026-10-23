import Link from "next/link";
import { AppHeader } from "../components/app-header";
import { BottomNav } from "../components/bottom-nav";
import { ServiceBrowser } from "./service-browser";

export default function ServicesPage() {
  return (
    <main className="page-wrap">
      <AppHeader><Link href="/my-trip" className="top-link">My Trip</Link></AppHeader>
      <div className="page-intro">
        <h1>บริการของชุมชน</h1>
        <p className="lead">เลือกดูสถานที่และบริการที่ผู้ประกอบการซึ่งได้รับอนุมัติเพิ่มไว้</p>
      </div>
      <ServiceBrowser />
      <BottomNav />
    </main>
  );
}
