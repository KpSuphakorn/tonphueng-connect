import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function StaffRegisterPage() {
  return (
    <main className="login-shell">
      <Link href="/" className="brand" aria-label="Tonphueng Connect หน้าหลัก">
        <span className="brand-mark" aria-hidden="true">ผ</span>
        <span>ผึ้งพาเดิน <span style={{ color: "var(--muted)", fontWeight: 500 }}>บ้านต้นผึ้ง</span></span>
      </Link>
      <section className="login-card register-card" aria-labelledby="register-heading" style={{ marginTop: 24 }}>
        <p className="eyebrow">STAFF REGISTRATION</p>
        <h1 id="register-heading">สมัครผู้ประกอบการชุมชน</h1>
        <p className="login-intro">ส่งข้อมูลกิจการให้ผู้ดูแลตรวจสอบ บัญชีจะเริ่มใช้งานได้หลังได้รับอนุมัติ</p>
        <RegisterForm />
      </section>
      <Link href="/login" className="back-link">กลับไปเข้าสู่ระบบ</Link>
    </main>
  );
}
