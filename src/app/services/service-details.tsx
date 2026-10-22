"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicService } from "../../lib/services";

export function ServiceDetails({ service, canSave }: { service: PublicService; canSave: boolean }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mapUrl = new URL("https://www.google.com/maps/search/");
  mapUrl.searchParams.set("api", "1");
  mapUrl.searchParams.set("query", `${service.latitude},${service.longitude}`);
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/my-trip", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: service.id }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      setMessage(result.message || "บันทึกเข้า My Trip แล้ว");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  }
  return <article>
    <p className="eyebrow">{service.category.replaceAll("_", " ").toUpperCase()}</p>
    <h1>{service.name}</h1>
    <div className="service-gallery">
      {service.photos.length ? <img src={service.photos[imageIndex]} alt={`รูปที่ ${imageIndex + 1} ของ ${service.name}`} /> : <div className="service-image-placeholder">ยังไม่มีรูปภาพ</div>}
      {service.photos.length > 1 && <div className="gallery-controls"><button className="button button-secondary" onClick={() => setImageIndex((imageIndex + service.photos.length - 1) % service.photos.length)}>รูปก่อนหน้า</button><span aria-live="polite">รูป {imageIndex + 1} จาก {service.photos.length}</span><button className="button button-secondary" onClick={() => setImageIndex((imageIndex + 1) % service.photos.length)}>รูปถัดไป</button></div>}
    </div>
    <section className="service-detail-copy"><h2>รายละเอียด</h2><p>{service.description || "ผู้ประกอบการยังไม่ได้เพิ่มรายละเอียด"}</p><h2>ที่อยู่</h2><p>{service.address}</p><p><a className="text-link" href={mapUrl.toString()} target="_blank" rel="noreferrer">เปิดพิกัดใน Google Maps</a></p><h2>ติดต่อ</h2><p><a className="text-link" href={`tel:${service.phone}`}>{service.phone}</a></p></section>
    {canSave ? <button className="button button-primary button-wide" disabled={busy} onClick={save}>{busy ? "กำลังบันทึก…" : "บันทึกเข้า My Trip"}</button> : <p className="note-card">เข้าสู่ระบบด้วย LINE เพื่อบันทึกสถานที่ <Link className="text-link" href="/login">เข้าสู่ระบบ</Link></p>}
    {message && <p className="success-message" role="status">{message}</p>}
  </article>;
}
