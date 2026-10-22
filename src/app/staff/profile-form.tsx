"use client";

import { useState, type FormEvent } from "react";
import type { StaffDetails } from "../../lib/staff";

const categories = [
  ["community_product", "สินค้าชุมชน"],
  ["accommodation", "ที่พัก"],
  ["restaurant", "ร้านอาหาร"],
  ["tourism_trail", "การท่องเที่ยว / เส้นทางเดินป่า"],
  ["other", "อื่น ๆ"],
] as const;

export function StaffProfileForm({ profile }: { profile: StaffDetails }) {
  const [category, setCategory] = useState(profile.category);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/staff/profile", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: new FormData(event.currentTarget),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกข้อมูลไม่สำเร็จ");
      setMessage(result.message || "บันทึกข้อมูลแล้ว");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
      setBusy(false);
    }
  }

  return (
    <section className="staff-profile-card" aria-labelledby="profile-heading">
      <h2 id="profile-heading">ข้อมูลกิจการ</h2>
      {profile.photos.length > 0 && <div className="business-photos" aria-label="รูปกิจการ">
        {profile.photos.map((photo, index) => <img key={photo} src={photo} alt={`รูปกิจการ ${index + 1}`} />)}
      </div>}
      <form className="form-stack" onSubmit={save}>
        <label className="field">ชื่อกิจการ<input name="name" required maxLength={160} defaultValue={profile.name} /></label>
        <label className="field">ที่อยู่<textarea name="address" required maxLength={1000} defaultValue={profile.address} /></label>
        <div className="coordinate-fields">
          <label className="field">ละติจูด<input type="number" name="latitude" required min={-90} max={90} step="any" defaultValue={profile.latitude} /></label>
          <label className="field">ลองจิจูด<input type="number" name="longitude" required min={-180} max={180} step="any" defaultValue={profile.longitude} /></label>
        </div>
        <label className="field">เบอร์โทรศัพท์<input name="phone" type="tel" required maxLength={40} defaultValue={profile.phone} /></label>
        <label className="field">ประเภทกิจการ<select name="category" value={category} onChange={(event) => setCategory(event.target.value as StaffDetails["category"])}>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        {category === "other" && <label className="field">ระบุประเภทอื่น<input name="other_category" required maxLength={120} defaultValue={profile.other_category ?? ""} /></label>}
        <label className="field">เปลี่ยนรูปกิจการ (ไม่เกิน 19 รูป)<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple /></label>
        <p className="form-help">หากไม่เลือกรูปใหม่ ระบบจะเก็บรูปเดิมไว้ รูปใหม่ต้องเป็น JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB ต่อไฟล์</p>
        <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกข้อมูลกิจการ"}</button>
      </form>
      {message && <p className="error-message" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
