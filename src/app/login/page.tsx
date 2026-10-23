import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <Link href="/" className="login-logo" aria-label="Tonphueng Connect หน้าหลัก">
        <img src="/images/logo.jpeg" width={104} height={104} alt="ผึ้งพาเดิน" />
      </Link>
      <section className="login-card" aria-labelledby="login-heading">
        <h1 id="login-heading">เข้าสู่ระบบ Tonphueng Connect</h1>
        <p className="login-intro">เลือกประเภทบัญชีเพื่อไปยังพื้นที่ของคุณ</p>
        <LoginForm />
        <p className="register-prompt">ยังไม่ได้สมัครเป็นผู้ประกอบการ? <Link href="/staff/register">สมัครผู้ประกอบการชุมชน</Link></p>
      </section>
    </main>
  );
}
