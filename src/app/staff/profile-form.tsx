"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { uploadStaffPhotosDirectly } from "./photo-upload";
import type { StaffDetails } from "../../lib/staff";
import { useFormDraft } from "../components/session-draft";

/** Text fields kept as a session draft on top of the saved profile (photo files are never stored). */
const draftFields = ["name", "description", "address", "latitude", "longitude", "phone", "category", "other_category"] as const;

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
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // The saved profile is the draft's base: a draft typed on an older saved profile is dropped (server wins).
  const base = useMemo(() => ({
    name: profile.name, description: profile.description ?? "", address: profile.address, latitude: String(profile.latitude),
    longitude: String(profile.longitude), phone: profile.phone, category: profile.category, other_category: profile.other_category ?? "",
  }), [profile]);
  const draft = useFormDraft(formRef, `staff-profile:${profile.id}`, draftFields, base);
  useEffect(() => { if (draft.restored?.category) setCategory(draft.restored.category as StaffDetails["category"]); }, [draft.restored]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setSaved(false);
    try {
      const form = event.currentTarget;
      const fileInput = form.elements.namedItem("photos") as HTMLInputElement;
      const uploadSession = await uploadStaffPhotosDirectly(Array.from(fileInput.files ?? []), "profile");
      const body = new FormData(form);
      body.delete("photos");
      if (uploadSession) body.set("upload_session", uploadSession);
      const response = await fetch("/api/staff/profile", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body,
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกข้อมูลไม่สำเร็จ");
      fileInput.value = "";
      draft.clear();
      setMessage(result.message || "บันทึกข้อมูลแล้ว");
      setSaved(true);
      setBusy(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
      setSaved(false);
      setBusy(false);
    }
  }

  return (
    <section className="staff-profile-card" aria-labelledby="profile-heading">
      <h2 id="profile-heading">ข้อมูลกิจการ</h2>
      <p className="form-help">* จำเป็นต้องกรอก</p>
      {profile.photos.length > 0 && <div className="business-photos" aria-label="รูปกิจการ">
        {profile.photos.map((photo, index) => <img key={photo} src={photo} alt={`รูปกิจการ ${index + 1}`} />)}
      </div>}
      <form ref={formRef} className="form-stack" onSubmit={save} onInput={draft.save} onChange={draft.save}>
        <label className="field"><span>ชื่อกิจการ <span className="required-marker" aria-hidden="true">*</span></span><input name="name" required maxLength={160} defaultValue={profile.name} /></label>
        <label className="field">รายละเอียดกิจการ<textarea name="description" maxLength={4000} defaultValue={profile.description} /></label>
        <label className="field"><span>ที่อยู่ <span className="required-marker" aria-hidden="true">*</span></span><textarea name="address" required maxLength={1000} defaultValue={profile.address} /></label>
        <div className="coordinate-fields">
          <label className="field"><span>ละติจูด <span className="required-marker" aria-hidden="true">*</span></span><input type="number" inputMode="decimal" name="latitude" required min={-90} max={90} step="any" defaultValue={profile.latitude} /></label>
          <label className="field"><span>ลองจิจูด <span className="required-marker" aria-hidden="true">*</span></span><input type="number" inputMode="decimal" name="longitude" required min={-180} max={180} step="any" defaultValue={profile.longitude} /></label>
        </div>
        <label className="field"><span>เบอร์โทรศัพท์ <span className="required-marker" aria-hidden="true">*</span></span><input name="phone" type="tel" required maxLength={40} defaultValue={profile.phone} /></label>
        <label className="field"><span>ประเภทกิจการ <span className="required-marker" aria-hidden="true">*</span></span><select name="category" required value={category} onChange={(event) => setCategory(event.target.value as StaffDetails["category"])}>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        {category === "other" && <label className="field"><span>ระบุประเภทอื่น <span className="required-marker" aria-hidden="true">*</span></span><input name="other_category" required maxLength={120} defaultValue={draft.restored?.other_category ?? profile.other_category ?? ""} /></label>}
        <label className="field">เปลี่ยนรูปกิจการ (ไม่เกิน 19 รูป)<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple /></label>
        <p className="form-help">หากไม่เลือกรูปใหม่ ระบบจะเก็บรูปเดิมไว้ รูปใหม่ต้องเป็น JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB ต่อไฟล์</p>
        <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกข้อมูลกิจการ"}</button>
      </form>
      {message && <p className={saved ? "success-message" : "error-message"} role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
