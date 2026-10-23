import { notFound } from "next/navigation";
import { getAccountFromCookies } from "../../../lib/auth";
import { getCustomerPackageSelections, getPublicPackageData } from "../../../lib/packages";
import { PackageOptions, type PackageView, type SavedPackageSelection } from "../package-options";

import { AppHeader } from "../../components/app-header";
import { BottomNav } from "../../components/bottom-nav";
import { Icon } from "../../components/icons";

export const dynamic = "force-dynamic";

export default async function PackageDetailsPage({ params }: { params: Promise<{ subPackageId: string }> }) {
  const { subPackageId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(subPackageId)) notFound();
  let categories;
  try { categories = await getPublicPackageData(); } catch { return <main className="page-wrap"><AppHeader back={{ href: "/packages", label: "แพ็กเกจ" }} /><p className="error-message" role="alert">โหลดแพ็กเกจไม่สำเร็จ</p><BottomNav /></main>; }
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
      <AppHeader back={{ href: "/packages", label: "แพ็กเกจ" }} />
      <div className="page-intro">
        <span className="chip">{category.category_title}</span>
        <h1>{subPackage.title}</h1>
        {subPackage.description && <p className="lead">{subPackage.description}</p>}
      </div>
      <section className="package-detail-price"><span>ราคาต่อคน</span><strong>{new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(subPackage.price_per_person_satang / 100)}</strong><small>ระยะเวลา {subPackage.duration_days} วัน · ระบบคำนวณยอดจากจำนวนผู้เข้าร่วมและแสดงยอดที่บันทึกก่อนชำระเงิน</small></section>
      <PackageOptions packageView={packageView} canSelect={isCustomer} savedSelection={saved} />
      {category.contact_url && <p><a className="text-link" href={category.contact_url} target="_blank" rel="noreferrer">สอบถามแพ็กเกจเพิ่มเติม <Icon name="external" size={16} /></a></p>}
      {!isCustomer && <p className="form-help">เข้าสู่ระบบด้วยบัญชีลูกค้าเพื่อบันทึกตัวเลือกนี้</p>}
      <BottomNav />
    </main>
  );
}
