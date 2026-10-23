import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountFromCookies } from "../../lib/auth";
import { LoginForm } from "./login-form";

const roleHome = { customer: "/", staff: "/staff", admin: "/admin" } as const;
/** Query keys LIFF adds when returning from LINE login; the form must finish that flow instead of being redirected. */
const liffCallbackKeys = ["code", "state", "liffClientId", "liff.state", "liffRedirectUri", "liffOAuth2Error", "error"];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const switching = params.switch === "1";
  // An active session goes straight to its area; `?switch=1` (also used after logout) keeps the role picker reachable.
  if (!switching && !liffCallbackKeys.some((key) => key in params)) {
    const account = await getAccountFromCookies();
    if (account?.status === "active" && account.role in roleHome) redirect(roleHome[account.role as keyof typeof roleHome]);
  }
  return (
    <main className="login-shell">
      <Link href="/" className="login-logo" aria-label="Tonphueng Connect หน้าหลัก">
        <img src="/images/logo.jpeg" width={104} height={104} alt="ผึ้งพาเดิน" />
      </Link>
      <section className="login-card" aria-labelledby="login-heading">
        <h1 id="login-heading">เข้าสู่ระบบ Tonphueng Connect</h1>
        <p className="login-intro">เลือกประเภทบัญชีเพื่อไปยังพื้นที่ของคุณ</p>
        <LoginForm switching={switching} />
        <p className="register-prompt">ยังไม่ได้สมัครเป็นผู้ประกอบการ? <Link href="/staff/register">สมัครผู้ประกอบการชุมชน</Link></p>
      </section>
    </main>
  );
}
