import Link from "next/link";
import { getPublicPackageData } from "../../lib/packages";
import { AppHeader } from "../components/app-header";
import { BottomNav } from "../components/bottom-nav";
import { Icon } from "../components/icons";
type PublicCategory = Awaited<ReturnType<typeof getPublicPackageData>>[number];

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  let categories: PublicCategory[];
  let failed = false;
  try { categories = await getPublicPackageData(); } catch { categories = []; failed = true; }
  return (
    <main className="page-wrap">
      <AppHeader back={{ href: "/", label: "หน้าหลัก" }} />
      <div className="page-intro">
        <h1>เลือกประสบการณ์ของชุมชน</h1>
        <p className="lead">ราคาและตัวเลือกกำหนดโดยผู้ดูแลโครงการ ราคาที่แสดงเป็นราคาต่อคนและยังไม่ใช่การจอง</p>
      </div>
      {failed ? <p className="error-message" role="alert">โหลดแพ็กเกจไม่สำเร็จ กรุณาลองใหม่</p> : (
        <div className="package-category-grid">
          {categories.map((category) => (
            <section className="package-category-card" key={category.category}>
              <h2>{category.title}</h2>
              {category.category_title !== category.title && <p className="availability">{category.category_title}</p>}
              {category.description && <p>{category.description}</p>}
              <div className="package-sub-list">
                {category.sub_packages.length ? category.sub_packages.map((subPackage) => (
                  <Link className="package-sub-link" href={`/packages/${subPackage.id}`} key={subPackage.id}>
                    <span><strong>{subPackage.title}</strong><small>เลือก {subPackage.slots.reduce((total, slot) => total + slot.required_count, 0)} รายการ</small></span>
                    <span className="package-price">{new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(subPackage.price_per_person_satang / 100)}<small>/ คน</small></span>
                    <Icon name="chevronRight" size={20} />
                  </Link>
                )) : <p className="form-help">ยังไม่มีแพ็กเกจย่อยให้เลือก</p>}
              </div>
              {category.contact_url ? <a className="text-link" href={category.contact_url} target="_blank" rel="noreferrer">สอบถามแพ็กเกจเพิ่มเติม <Icon name="external" size={16} /></a> : <p className="form-help">ยังไม่ได้ตั้งค่าช่องทางติดต่อสำหรับแพ็กเกจเพิ่มเติม</p>}
            </section>
          ))}
        </div>
      )}
      <BottomNav />
    </main>
  );
}
