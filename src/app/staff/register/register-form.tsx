"use client";

import { useState, type FormEvent } from "react";
import { uploadStaffPhotosDirectly } from "../photo-upload";

const categories = [
  ["community_product", "สินค้าชุมชน"],
  ["accommodation", "ที่พัก"],
  ["restaurant", "ร้านอาหาร"],
  ["tourism_trail", "การท่องเที่ยว / เส้นทางเดินป่า"],
  ["other", "อื่น ๆ"],
] as const;

export function RegisterForm() {
  const [category, setCategory] = useState("community_product");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("photos") as HTMLInputElement;
    if (fileInput.files && fileInput.files.length >= 20) {
      setMessage("กรุณาแนบรูปกิจการไม่เกิน 19 รูป");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const files = Array.from(fileInput.files ?? []);
      const uploadSession = await uploadStaffPhotosDirectly(files, "registration");
      const body = new FormData(form);
      body.delete("photos");
      if (uploadSession) body.set("upload_session", uploadSession);
      const response = await fetch("/api/staff/register", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body,
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "สมัครไม่สำเร็จ");
      setPending(true);
      setMessage(result.message || "ส่งข้อมูลแล้ว กำลังรอผู้ดูแลอนุมัติ");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "สมัครไม่สำเร็จ กรุณาลองอีกครั้ง");
      setBusy(false);
    }
  }

  if (pending) return <div className="pending-notice" role="status">
    <h2>ส่งข้อมูลเรียบร้อยแล้ว</h2>
    <p>{message}</p>
    <p>คุณจะเข้าสู่ระบบและจัดการกิจการได้หลังผู้ดูแลตรวจสอบและอนุมัติ</p>
    <a className="button button-secondary button-wide" href="/login">กลับไปหน้าเข้าสู่ระบบ</a>
  </div>;

  return <form className="form-stack" onSubmit={submit}>
    <p className="form-help"><span className="required-marker" aria-hidden="true">*</span> จำเป็นต้องกรอก</p>
    <label className="field"><span>ชื่อกิจการ <span className="required-marker" aria-hidden="true">*</span></span><input name="name" required maxLength={160} autoComplete="organization" /></label>
    <label className="field"><span>ที่อยู่ <span className="required-marker" aria-hidden="true">*</span></span><textarea name="address" required maxLength={1000} autoComplete="street-address" /></label>
    <div className="coordinate-fields">
      <label className="field"><span>ละติจูด <span className="required-marker" aria-hidden="true">*</span></span><input name="latitude" type="number" required min={-90} max={90} step="any" inputMode="decimal" /></label>
      <label className="field"><span>ลองจิจูด <span className="required-marker" aria-hidden="true">*</span></span><input name="longitude" type="number" required min={-180} max={180} step="any" inputMode="decimal" /></label>
    </div>
    <label className="field"><span>เบอร์โทรศัพท์ <span className="required-marker" aria-hidden="true">*</span></span><input name="phone" type="tel" required maxLength={40} autoComplete="tel" /></label>
    <label className="field"><span>ประเภทกิจการ <span className="required-marker" aria-hidden="true">*</span></span><select name="category" required value={category} onChange={(event) => setCategory(event.target.value)}>
      {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {category === "other" && <label className="field"><span>ระบุประเภทอื่น <span className="required-marker" aria-hidden="true">*</span></span><input name="other_category" required maxLength={120} /></label>}
    <label className="field"><span>รูปกิจการ (1–19 รูป) <span className="required-marker" aria-hidden="true">*</span></span><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required /></label>
    <p className="form-help">รองรับ JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB ต่อไฟล์ และรวมไม่เกิน 25 MB</p>
    <label className="field"><span>อีเมล <span className="required-marker" aria-hidden="true">*</span></span><input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
    <label className="field"><span>รหัสผ่าน <span className="required-marker" aria-hidden="true">*</span></span><input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label>
    <p className="form-help">รหัสผ่านใช้สำหรับเข้าสู่ระบบและจะไม่แสดงในข้อมูลกิจการ</p>
    <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? "กำลังส่งข้อมูล…" : "ส่งข้อมูลสมัคร"}</button>
    {message && <p className="error-message" role="status" aria-live="polite">{message}</p>}
  </form>;
}
