import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccountFromCookies } from "../../../lib/auth";
import { getCustomerPackageSelections, getPublicPackageData } from "../../../lib/packages";
import { PackageOptions, type PackageView, type SavedPackageSelection } from "../package-options";

export const dynamic = "force-dynamic";

export default async function PackageDetailsPage({ params }: { params: Promise<{ subPackageId: string }> }) {
  const { subPackageId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(subPackageId)) notFound();
  let categories;
  try { categories = await getPublicPackageData(); } catch { return <main className="page-wrap"><p className="error-message">โหลดแพ็กเกจไม่สำเร็จ</p></main>; }
  const category = categories.find((item) => item.sub_packages.some((subPackage) => subPackage.id === subPackageId));
  const subPackage = category?.sub_packages.find((item) => item.id === subPackageId);
  if (!category || !subPackage) notFound();
  const account = await getAccountFromCookies();
  const isCustomer = account?.role === "customer" && account.status === "active";
  let saved: SavedPackageSelection | null = null;
  if (isCustomer) {
    try {
      const selections = await getCustomerPackageSelections(account.id);
      saved = selections.find((item) => item.sub_package_id === subPackageId) as SavedPackageSelection | undefined ?? null;
    } catch { /* The details remain viewable when a saved selection cannot be loaded. */ }
  }
  const packageView: PackageView = { category: category.category, revision: category.revision, category_title: category.category_title, ...subPackage };
  return (
    <main className="page-wrap">
      <header className="topbar"><Link href="/packages" className="top-link">← แพ็กเกจ</Link><Link href="/" className="brand">ผึ้งพาเดิน · {category.category_title}</Link></header>
      <p className="eyebrow">{category.category_title} · ข้อมูลตัวอย่าง</p>
      <h1>{subPackage.title}</h1>
      <p className="lead">{subPackage.description}</p>
      <section className="package-detail-price"><span>ราคาตัวอย่างต่อคน</span><strong>{new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(subPackage.price_per_person_satang / 100)}</strong><small>ระยะเวลา {subPackage.duration_days} วัน · ระบบคำนวณยอดจากจำนวนผู้เข้าร่วมและแสดงยอดที่บันทึกก่อนยืนยันจ่ายจำลอง</small></section>
      <PackageOptions packageView={packageView} canSelect={isCustomer} savedSelection={saved} />
      {category.contact_url && <p><a className="text-link" href={category.contact_url} target="_blank" rel="noreferrer">สอบถามแพ็กเกจเพิ่มเติม ↗</a></p>}
      {!isCustomer && <p className="form-help">เข้าสู่ระบบด้วยบัญชี Customer เพื่อบันทึกตัวเลือกนี้</p>}
    </main>
  );
}
