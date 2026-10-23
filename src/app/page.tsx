import Link from "next/link";
import { getAccountFromCookies } from "../lib/auth";
import { LogoutButton } from "./login/login-form";
import { Brand } from "./components/app-header";
import { BottomNav } from "./components/bottom-nav";
import { Icon, type IconName } from "./components/icons";

const offers: Array<{ href: string; title: string; description: string; image: string; icon: IconName }> = [
  {
    href: "/packages",
    title: "แพ็กเกจชุมชน",
    description: "เลือกประสบการณ์และเส้นทางเรียนรู้ของบ้านต้นผึ้ง",
    image: "/images/card-packages.webp",
    icon: "backpack",
  },
  {
    href: "/products",
    title: "สินค้าชุมชน",
    description: "เลือกหนึ่งร้านเพื่อดูสินค้าและจัดตะกร้า",
    image: "/images/card-products.webp",
    icon: "store",
  },
  {
    href: "/services",
    title: "บริการของเรา",
    description: "สำรวจที่พัก ร้านอาหาร และบริการท่องเที่ยว",
    image: "/images/card-services.webp",
    icon: "leaf",
  },
];

export default async function HomePage() {
  const account = await getAccountFromCookies();
  const isCustomer = account?.role === "customer" && account.status === "active";

  return (
    <>
      <section className="home-hero" aria-labelledby="home-heading">
        <img className="home-hero-photo" src="/images/hero-sea-of-mist.webp" width={1280} height={853} alt="" fetchPriority="high" />
        <div className="home-hero-inner">
          <header className="topbar">
            <Brand />
            {isCustomer ? <LogoutButton /> : <Link className="top-link" href="/login">เข้าสู่ระบบ</Link>}
          </header>
          <div className="home-hero-copy">
            <p className="home-place"><Icon name="pin" size={18} />บ้านต้นผึ้ง จ.เชียงใหม่</p>
            <h1 id="home-heading">รู้จักบ้านต้นผึ้ง<br />ผ่านประสบการณ์ของชุมชน</h1>
            <p className="lead">เลือกชมสินค้าและบริการ วางแผนทริป และติดตามรายการของคุณได้จากที่เดียว</p>
            {!isCustomer && <Link href="/login" className="button button-accent">เริ่มต้นใช้งาน</Link>}
          </div>
        </div>
      </section>

      <main className="page-wrap">
        <section className="section" aria-labelledby="discover-heading">
          <div className="section-heading"><h2 id="discover-heading">มีอะไรให้เลือกบ้าง</h2></div>
          <ul className="offer-list">
            {offers.map((offer) => (
              <li key={offer.href}>
                <Link className="offer-card" href={offer.href}>
                  <span className="offer-card-media"><img src={offer.image} width={960} height={720} alt="" loading="lazy" /></span>
                  <span className="offer-card-body">
                    <span className="offer-icon"><Icon name={offer.icon} /></span>
                    <span className="offer-copy"><span className="offer-title">{offer.title}</span><span className="offer-text">{offer.description}</span></span>
                    <Icon name="chevronRight" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-note" aria-label="ข้อมูล My Trip">
          <strong>ทริปและรายการของคุณ</strong>
          <p>{isCustomer ? "เปิด My Trip เพื่อดูสถานที่และตัวเลือกแพ็กเกจที่บันทึกไว้ ส่วน My Order จะแสดงคำสั่งซื้อเมื่อเปิดใช้งาน" : "เข้าสู่ระบบด้วย LINE เพื่อดู My Trip และ My Order ของบัญชีคุณ"}</p>
        </section>

        <footer className="site-footer"><Link href="/credits">เครดิตภาพ</Link></footer>
      </main>
      <BottomNav current="home" />
    </>
  );
}
