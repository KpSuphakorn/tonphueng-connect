import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <Link href="/" className="brand" aria-label="Tonphueng Connect หน้าหลัก">
        <span className="brand-mark" aria-hidden="true">ผ</span>
        <span>ผึ้งพาเดิน <span style={{ color: "var(--muted)", fontWeight: 500 }}>บ้านต้นผึ้ง</span></span>
      </Link>
      <section className="login-card" aria-labelledby="login-heading" style={{ marginTop: 24 }}>
        <p className="eyebrow">TONPHUENG CONNECT</p>
        <h1 id="login-heading">เข้าสู่ระบบ Tonphueng Connect</h1>
        <p className="login-intro">เลือกประเภทบัญชีเพื่อไปยังพื้นที่ของคุณ</p>
        <LoginForm />
      </section>
      <Link href="/" className="back-link">กลับหน้าหลัก</Link>
    </main>
  );
}
