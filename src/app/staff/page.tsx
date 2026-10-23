import Link from "next/link";
import { getAccountFromCookies } from "../../lib/auth";
import { getStaffDetails, type StaffProfile } from "../../lib/staff";
import { createServiceClient } from "../../lib/supabase";
import { LogoutButton } from "../login/login-form";
import { StaffProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const account = await getAccountFromCookies();
  if (!account || account.role !== "staff" || account.status !== "active") {
    return (
      <main className="page-wrap">
        <section className="protected-card">
          <p className="eyebrow">STAFF</p>
          <h1>พื้นที่ผู้ประกอบการชุมชน</h1>
          <p>บัญชีนี้ยังไม่มีสิทธิ์ Staff ที่อนุมัติแล้ว กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับอนุมัติ</p>
          <Link href="/login" className="button button-primary">ไปหน้าเข้าสู่ระบบ</Link>
        </section>
      </main>
    );
  }

  const { data: profile, error } = await createServiceClient().from("services")
    .select("id,account_id,name,description,address,latitude,longitude,phone,category,other_category,photo_paths")
    .eq("account_id", account.id)
    .maybeSingle();
  const details = profile && !error ? await getStaffDetails(profile as StaffProfile) : null;

  return (
    <main className="page-wrap">
      <header className="topbar">
        <Link href="/staff" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน · ผู้ประกอบการ</Link>
        <LogoutButton />
      </header>
      <p className="eyebrow">STAFF WORKSPACE</p>
      <h1>ข้อมูลกิจการของฉัน</h1>
      <p><Link href="/staff/products" className="button button-secondary">จัดการสินค้าของฉัน</Link> <Link href="/staff/orders" className="button button-secondary">คำสั่งซื้อของร้าน</Link></p>
      {details ? <StaffProfileForm profile={details} /> : (
        <section className="protected-card" role="alert">
          <p className="error-message">ไม่สามารถโหลดข้อมูลกิจการได้ กรุณาลองใหม่อีกครั้ง</p>
        </section>
      )}
    </main>
  );
}
