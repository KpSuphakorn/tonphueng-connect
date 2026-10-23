import type { Metadata } from "next";
import Link from "next/link";
import { PHOTO_CREDITS } from "../../../scripts/demo-data/catalog";

export const metadata: Metadata = { title: "เครดิตภาพ" };

export default function CreditsPage() {
  return (
    <main className="page-wrap">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">ผ</span> ผึ้งพาเดิน</Link>
      </header>
      <h1>เครดิตภาพ</h1>
      <p className="lead">ภาพประกอบบริการและสินค้ามาจาก Wikimedia Commons ตามสัญญาอนุญาตของเจ้าของภาพแต่ละรายการ</p>
      <ul className="store-list section">
        {PHOTO_CREDITS.map((credit) => (
          <li key={credit.file} style={{ display: "grid", gap: 4, padding: "12px 4px", overflowWrap: "anywhere" }}>
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
