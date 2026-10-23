"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type Applicant = {
  accountId: string;
  email: string;
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  category: string;
  other_category: string | null;
  photos: string[];
};

const categoryLabels: Record<string, string> = {
  community_product: "สินค้าชุมชน",
  accommodation: "ที่พัก",
  restaurant: "ร้านอาหาร",
  tourism_trail: "การท่องเที่ยว / เส้นทางเดินป่า",
  other: "อื่น ๆ",
};

export function StaffApproval({ applicants }: { applicants: Applicant[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function approve(accountId: string) {
    setBusyId(accountId);
    setError("");
    try {
      const response = await fetch(`/api/admin/staff/${accountId}/approve`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "อนุมัติไม่สำเร็จ");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "อนุมัติไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusyId("");
    }
  }

  if (!applicants.length) return <section className="note-card" role="status"><strong>ไม่มีผู้สมัครที่รออนุมัติ</strong><p>รายการจะแสดงเมื่อมีผู้ประกอบการส่งข้อมูลสมัคร</p></section>;

  return <section className="approval-list" aria-label="ผู้สมัครที่รออนุมัติ">
    {applicants.map((applicant) => <article className="applicant-card" key={applicant.accountId}>
      <div className="applicant-heading"><div><span className="status-badge status-pending">รออนุมัติ</span><h2>{applicant.name}</h2></div>
        <button className="button button-primary" type="button" disabled={busyId !== ""} onClick={() => approve(applicant.accountId)}>
          {busyId === applicant.accountId ? "กำลังอนุมัติ…" : "อนุมัติผู้ประกอบการ"}
        </button>
      </div>
      <dl className="applicant-details">
        <div><dt>ที่อยู่</dt><dd>{applicant.address}</dd></div>
        <div><dt>อีเมล</dt><dd>{applicant.email}</dd></div>
        <div><dt>พิกัด GPS</dt><dd>{applicant.latitude}, {applicant.longitude}</dd></div>
        <div><dt>เบอร์โทรศัพท์</dt><dd>{applicant.phone}</dd></div>
        <div><dt>ประเภทกิจการ</dt><dd>{categoryLabels[applicant.category] ?? applicant.category}{applicant.other_category ? `: ${applicant.other_category}` : ""}</dd></div>
      </dl>
      {applicant.photos.length > 0 ? <div className="business-photos" aria-label="รูปกิจการ">
        {applicant.photos.map((photo, index) => <img key={photo} src={photo} alt={`รูปกิจการ ${index + 1} ของ ${applicant.name}`} />)}
      </div> : <p className="form-help">ผู้สมัครยังไม่ได้แนบรูปกิจการ</p>}
    </article>)}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
