import Link from "next/link";
import { getPublicPackageData } from "../../lib/packages";
type PublicCategory = Awaited<ReturnType<typeof getPublicPackageData>>[number];

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  let categories: PublicCategory[];
  let failed = false;
  try { categories = await getPublicPackageData(); } catch { categories = []; failed = true; }
  return (
    <main className="page-wrap">
      <header className="topbar"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน · แพ็กเกจ</Link><Link href="/" className="top-link">หน้าหลัก</Link></header>
      <p className="eyebrow">EXPERIENCE PACKAGES · ข้อมูลตัวอย่าง</p>
      <h1>เลือกประสบการณ์ของชุมชน</h1>
      <p className="lead">ราคาและตัวเลือกเป็นข้อมูลตัวอย่างที่ผู้ดูแลโครงการบันทึกไว้ ราคาที่แสดงเป็นราคาต่อคนและยังไม่ใช่การจอง</p>
      {failed ? <p className="error-message" role="alert">โหลดแพ็กเกจไม่สำเร็จ กรุณาลองใหม่</p> : (
        <div className="package-category-grid">
          {categories.map((category) => (
            <section className="package-category-card" key={category.category}>
              <p className="eyebrow">{category.category_title}</p>
              <h2>{category.title}</h2>
              {category.description && <p>{category.description}</p>}
              <div className="package-sub-list">
                {category.sub_packages.length ? category.sub_packages.map((subPackage) => (
                  <Link className="package-sub-link" href={`/packages/${subPackage.id}`} key={subPackage.id}>
                    <span><strong>{subPackage.title}</strong><small>{subPackage.slots.length} ตัวเลือกตาม slot</small></span>
                    <span className="package-price">{new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(subPackage.price_per_person_satang / 100)}<small>/ คน</small></span>
                  </Link>
                )) : <p className="form-help">ยังไม่มี Sub Package ให้เลือก</p>}
              </div>
              {category.contact_url ? <a className="text-link" href={category.contact_url} target="_blank" rel="noreferrer">สอบถามแพ็กเกจเพิ่มเติม ↗</a> : <p className="form-help">ยังไม่ได้ตั้งค่าช่องทางติดต่อสำหรับแพ็กเกจเพิ่มเติม</p>}
            </section>
          ))}
        </div>
      )}
      <nav className="bottom-nav" aria-label="เมนูลูกค้า"><Link href="/">หน้าหลัก</Link><Link href="/my-trip">My Trip</Link><Link href="/my-order">My Order</Link></nav>
    </main>
  );
}
