import type { Metadata } from "next";
import Link from "next/link";
import { PHOTO_CREDITS } from "../../../scripts/demo-data/catalog";
import { AppHeader } from "../components/app-header";

export const metadata: Metadata = { title: "เครดิตภาพ" };

export default function CreditsPage() {
  return (
    <main className="page-wrap no-nav">
      <AppHeader back={{ href: "/", label: "หน้าหลัก" }} />
      <div className="page-intro">
        <h1>เครดิตภาพ</h1>
        <p className="lead">ภาพประกอบบนหน้าหลัก บริการ และสินค้ามาจาก Wikimedia Commons ตามสัญญาอนุญาตของเจ้าของภาพแต่ละรายการ</p>
      </div>
      <ul className="store-list credit-list">
        {PHOTO_CREDITS.map((credit) => (
          <li key={credit.file}>
            <strong>{credit.subject}</strong>
            <small>ภาพโดย {credit.author}</small>
            <small>
              <a className="text-link" href={credit.license_url} target="_blank" rel="noreferrer">{credit.license}</a>
              {" · "}
              <a className="text-link" href={credit.source_page_url} target="_blank" rel="noreferrer">ดูต้นฉบับ</a>
            </small>
          </li>
        ))}
      </ul>
      <Link href="/" className="back-link">กลับหน้าหลัก</Link>
    </main>
  );
}
