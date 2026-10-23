import Link from "next/link";
import { getAccountFromCookies } from "../../../lib/auth";
import { getAdminPackageData } from "../../../lib/packages";
import { PackageEditor } from "./package-editor";
import { AppHeader } from "../../components/app-header";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage() {
  const account = await getAccountFromCookies();
  if (!account || account.role !== "admin" || account.status !== "active") return <main className="page-wrap no-nav"><section className="protected-card"><h1>จัดการแพ็กเกจ</h1><p>กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ใช้งานได้</p><Link href="/login" className="button button-primary">ไปหน้าเข้าสู่ระบบ</Link></section></main>;
  try {
    const data = await getAdminPackageData();
    return <main className="page-wrap no-nav"><AppHeader back={{ href: "/admin", label: "พื้นที่ผู้ดูแล" }} /><h1>จัดการ Package และ Sub Package</h1><p className="lead">ราคาเป็นเงินบาทต่อคน เก็บเป็นจำนวนสตางค์ ระบบยังไม่สร้าง Booking หรือรับชำระเงิน</p><PackageEditor initialCatalogs={data.catalogs} services={data.services} /></main>;
  } catch {
    return <main className="page-wrap no-nav"><section className="protected-card" role="alert"><p className="error-message">โหลดข้อมูลแพ็กเกจและบริการไม่สำเร็จ</p></section></main>;
  }
}
