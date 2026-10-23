import Link from "next/link";
import { getAccountFromCookies } from "../../../lib/auth";
import { createServiceClient } from "../../../lib/supabase";
import { LogoutButton } from "../../login/login-form";
import { ProductEditor } from "./product-editor";
import { AppHeader } from "../../components/app-header";

export const dynamic = "force-dynamic";

export default async function StaffProductsPage() {
  const account = await getAccountFromCookies();
  if (!account || account.role !== "staff" || account.status !== "active") return <main className="page-wrap no-nav"><section className="protected-card"><h1>จัดการสินค้า</h1><p>บัญชีนี้ยังไม่มีสิทธิ์ Staff ที่อนุมัติแล้ว</p><Link href="/login" className="button button-primary">เข้าสู่ระบบ</Link></section></main>;
  const { data: service, error } = await createServiceClient().from("services").select("category").eq("account_id", account.id).maybeSingle();
  return <main className="page-wrap no-nav">
    <AppHeader brandHref="/staff" area="ผู้ประกอบการ"><LogoutButton /></AppHeader>
    <h1>สินค้าของฉัน</h1>
    <p className="lead">เพิ่มชื่อ รายละเอียด ราคา และรูปสินค้าให้ลูกค้าดูได้ ราคาบันทึกเป็นบาทและสตางค์</p>
    {error ? <p className="error-message" role="alert">โหลดข้อมูลร้านไม่สำเร็จ กรุณาลองใหม่</p> : service?.category !== "community_product" ? <p className="note-card">บัญชีนี้ยังไม่มีร้านประเภทสินค้าชุมชนที่เปิดใช้งาน จึงยังลงสินค้าไม่ได้</p> : <ProductEditor />}
    <Link className="back-link" href="/staff">กลับหน้าผู้ประกอบการ</Link>
  </main>;
}
