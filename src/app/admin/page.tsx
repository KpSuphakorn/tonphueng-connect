import Link from "next/link";
import { getAccountFromCookies } from "../../lib/auth";
import { getStaffDetails, type StaffProfile } from "../../lib/staff";
import { createServiceClient } from "../../lib/supabase";
import { LogoutButton } from "../login/login-form";
import { StaffApproval, type Applicant } from "./staff-approval";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const account = await getAccountFromCookies();
  if (!account || account.role !== "admin" || account.status !== "active") {
    return (
      <main className="page-wrap">
        <section className="protected-card">
          <p className="eyebrow">ADMIN</p>
          <h1>พื้นที่ผู้ดูแลโครงการ</h1>
          <p>กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่เจ้าของโครงการตั้งค่าไว้</p>
          <Link href="/login" className="button button-primary">ไปหน้าเข้าสู่ระบบ</Link>
        </section>
      </main>
    );
  }

  const client = createServiceClient();
  const { data, error } = await client.from("app_accounts")
    .select("id,auth_user_id,services(id,account_id,name,address,latitude,longitude,phone,category,other_category,photo_paths)")
    .eq("role", "staff")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const applicants: Applicant[] = [];
  let applicantLoadError = Boolean(error);
  if (!error && data) {
    for (const item of data) {
      const service = Array.isArray(item.services) ? item.services[0] : item.services;
      if (!service || !item.auth_user_id) {
        applicantLoadError = true;
        continue;
      }
      const { data: authData, error: authError } = await client.auth.admin.getUserById(item.auth_user_id);
      if (authError || !authData.user?.email) {
        applicantLoadError = true;
        continue;
      }
      applicants.push({ accountId: item.id, email: authData.user.email, ...(await getStaffDetails(service as StaffProfile)) });
    }
  }

  return (
    <main className="page-wrap">
      <header className="topbar">
        <Link href="/admin" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน · ผู้ดูแล</Link>
        <LogoutButton />
      </header>
      <p className="eyebrow">ADMIN WORKSPACE</p>
      <h1>ตรวจสอบผู้ประกอบการ</h1>
      {applicantLoadError ? <section className="protected-card" role="alert"><p className="error-message">ไม่สามารถโหลดรายการสมัครได้ กรุณาลองใหม่</p></section> : <StaffApproval applicants={applicants} />}
    </main>
  );
}
