import Link from "next/link";
import { getAccountFromCookies } from "../../../lib/auth";
import { getAdminPackageData } from "../../../lib/packages";
import { PackageEditor } from "./package-editor";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage() {
  const account = await getAccountFromCookies();
  if (!account || account.role !== "admin" || account.status !== "active") return <main className="page-wrap"><section className="protected-card"><p className="eyebrow">ADMIN</p><h1>จัดการแพ็กเกจ</h1><p>กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ใช้งานได้</p><Link href="/login" className="button button-primary">ไปหน้าเข้าสู่ระบบ</Link></section></main>;
  try {
    const data = await getAdminPackageData();
    return <main className="page-wrap"><header className="topbar"><Link href="/admin" className="top-link">← ผู้ดูแล</Link><Link href="/" className="brand">ผึ้งพาเดิน · จัดการแพ็กเกจ</Link></header><p className="eyebrow">ADMIN WORKSPACE</p><h1>จัดการ Package และ Sub Package</h1><p className="lead">ราคาเป็นเงินบาทต่อคน เก็บเป็นจำนวนสตางค์ ระบบยังไม่สร้าง Booking หรือรับชำระเงิน</p><PackageEditor initialCatalogs={data.catalogs} services={data.services} /></main>;
  } catch {
    return <main className="page-wrap"><section className="protected-card" role="alert"><p className="error-message">โหลดข้อมูลแพ็กเกจและบริการไม่สำเร็จ</p></section></main>;
  }
}
