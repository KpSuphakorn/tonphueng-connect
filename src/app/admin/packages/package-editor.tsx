"use client";

import { useState, type FormEvent } from "react";
import type { CatalogRow, PackageCatalog, PackageService, PackageSlot, SubPackage } from "../../../lib/packages";

const packageCategories = [
  { id: "trail_running", title: "Trail & Running" },
  { id: "wildfire_study", title: "Wild Fire Study" },
  { id: "cultural_study_trip", title: "Cultural Study Trip" },
] as const;

function newSubPackage(): SubPackage {
  return { id: crypto.randomUUID(), title: "", description: "", price_per_person_satang: 0, duration_days: 1, slots: [] };
}

function priceInput(satang: number) {
  if (satang <= 0) return "";
  return `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, "0")}`;
}

function priceInSatang(value: string) {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return null;
  const [baht, satang = ""] = value.split(".");
  const amount = Number(baht) * 100 + Number(satang.padEnd(2, "0"));
  return amount >= 1 && amount <= 100_000_000 ? amount : null;
}

function integerInput(value: string, min: number, max: number) {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}

export function PackageEditor({ initialCatalogs, services }: { initialCatalogs: CatalogRow[]; services: PackageService[] }) {
  const [catalogs, setCatalogs] = useState(initialCatalogs);
  const [selected, setSelected] = useState(initialCatalogs[0]?.category ?? packageCategories[0].id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  const current = catalogs.find((item) => item.category === selected)!;
  const update = (catalog: PackageCatalog) => setCatalogs((items) => items.map((item) => item.category === selected ? { ...item, catalog } : item));
  const updateSub = (index: number, subPackage: SubPackage) => update({ ...current.catalog, sub_packages: current.catalog.sub_packages.map((item, itemIndex) => itemIndex === index ? subPackage : item) });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    let valid = true;
    const subPackages = current.catalog.sub_packages.map((subPackage) => {
      const price = priceInSatang(numericDrafts[`price:${selected}:${subPackage.id}`] ?? priceInput(subPackage.price_per_person_satang));
      const duration = integerInput(numericDrafts[`duration:${selected}:${subPackage.id}`] ?? String(subPackage.duration_days ?? 1), 1, 30);
      const slots = subPackage.slots.map((slot) => {
        const requiredCount = integerInput(numericDrafts[`count:${selected}:${slot.id}`] ?? String(slot.required_count), 1, 10);
        if (requiredCount === null || slot.service_ids.length < requiredCount) valid = false;
        return { ...slot, required_count: requiredCount ?? slot.required_count };
      });
      if (price === null || duration === null || slots.length < 1) valid = false;
      return {
        ...subPackage,
        price_per_person_satang: price ?? subPackage.price_per_person_satang,
        duration_days: duration ?? subPackage.duration_days,
        slots,
      };
    });
    if (!valid) {
      setMessage("กรุณากรอกตัวเลขให้ถูกต้อง เพิ่ม slot อย่างน้อยหนึ่งรายการ และเลือกบริการให้ครบตามจำนวน");
      return;
    }
    const catalog = { ...current.catalog, sub_packages: subPackages };
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/packages", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: selected, revision: current.revision, catalog }) });
      const result = await response.json() as { error?: string; revision?: number };
      if (!response.ok) throw new Error(result.error || "บันทึกแพ็กเกจไม่สำเร็จ");
      setCatalogs((items) => items.map((item) => item.category === selected ? { ...item, catalog, revision: result.revision ?? item.revision } : item));
      setMessage("บันทึกแพ็กเกจแล้ว");
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกแพ็กเกจไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <form className="package-editor" onSubmit={(event) => void save(event)}>
    <p className="form-help"><span className="required-marker" aria-hidden="true">*</span> จำเป็นต้องกรอก</p>
    <label className="field"><span>ประเภทแพ็กเกจ <span className="required-marker" aria-hidden="true">*</span></span><select required value={selected} onChange={(event) => { setSelected(event.target.value as typeof selected); setMessage(""); }}>
      {packageCategories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
    </select></label>
    <div className="package-edit-panel">
      <label className="field"><span>ชื่อ Package <span className="required-marker" aria-hidden="true">*</span></span><input maxLength={160} value={current.catalog.title} onChange={(event) => update({ ...current.catalog, title: event.target.value })} required /></label>
      <label className="field">รายละเอียด Package<textarea maxLength={4000} value={current.catalog.description} onChange={(event) => update({ ...current.catalog, description: event.target.value })} /></label>
      <label className="field">ลิงก์สอบถามแพ็กเกจเพิ่มเติม (HTTPS)<input type="url" maxLength={500} placeholder="https://..." value={current.catalog.contact_url} onChange={(event) => update({ ...current.catalog, contact_url: event.target.value })} /></label>
    </div>
    <div className="package-editor-heading"><h2>Sub Packages</h2><button className="button button-secondary" type="button" onClick={() => update({ ...current.catalog, sub_packages: [...current.catalog.sub_packages, newSubPackage()] })}>เพิ่ม Sub Package</button></div>
    {current.catalog.sub_packages.map((subPackage, subIndex) => <article className="package-edit-panel" key={subPackage.id}>
      <div className="package-editor-heading"><h3>Sub Package {subIndex + 1}</h3><button className="text-button" type="button" onClick={() => update({ ...current.catalog, sub_packages: current.catalog.sub_packages.filter((_, index) => index !== subIndex) })}>ลบ</button></div>
      <label className="field"><span>ชื่อ Sub Package <span className="required-marker" aria-hidden="true">*</span></span><input maxLength={160} value={subPackage.title} onChange={(event) => updateSub(subIndex, { ...subPackage, title: event.target.value })} required /></label>
      <label className="field">รายละเอียด<textarea maxLength={4000} value={subPackage.description} onChange={(event) => updateSub(subIndex, { ...subPackage, description: event.target.value })} /></label>
      <label className="field"><span>ราคาต่อคน (บาท) <span className="required-marker" aria-hidden="true">*</span></span><input type="text" inputMode="decimal" maxLength={10} pattern="[0-9]{1,7}([.][0-9]{1,2})?" value={numericDrafts[`price:${selected}:${subPackage.id}`] ?? priceInput(subPackage.price_per_person_satang)} onChange={(event) => { const value = event.currentTarget.value; setNumericDrafts((drafts) => ({ ...drafts, [`price:${selected}:${subPackage.id}`]: value })); }} required /><small>ระบุราคา 0.01–1,000,000.00 บาท; ระบบเก็บเป็นสตางค์จำนวนเต็ม</small></label>
      <label className="field"><span>ระยะเวลา (วัน) <span className="required-marker" aria-hidden="true">*</span></span><input type="text" inputMode="numeric" maxLength={2} pattern="[0-9]{1,2}" value={numericDrafts[`duration:${selected}:${subPackage.id}`] ?? String(subPackage.duration_days ?? 1)} onChange={(event) => { const value = event.currentTarget.value; setNumericDrafts((drafts) => ({ ...drafts, [`duration:${selected}:${subPackage.id}`]: value })); }} required /><small>ระบุ 1–30 วัน; แพ็กเกจเดิมที่ยังไม่ระบุจะใช้ 1 วัน</small></label>
      <div className="package-editor-heading"><h4>ตัวเลือกตาม slot <span className="required-marker" aria-hidden="true">*</span></h4><button className="button button-secondary" type="button" onClick={() => updateSub(subIndex, { ...subPackage, slots: [...subPackage.slots, { id: crypto.randomUUID(), name: "", service_category: "tourism_trail", required_count: 1, service_ids: [] }] })}>เพิ่ม slot</button></div>
      {subPackage.slots.map((slot, slotIndex) => <SlotEditor key={slot.id} slot={slot} requiredCountDraft={numericDrafts[`count:${selected}:${slot.id}`] ?? String(slot.required_count)} onRequiredCountChange={(value) => setNumericDrafts((drafts) => ({ ...drafts, [`count:${selected}:${slot.id}`]: value }))} services={services} onChange={(next) => updateSub(subIndex, { ...subPackage, slots: subPackage.slots.map((item, index) => index === slotIndex ? next : item) })} onRemove={() => updateSub(subIndex, { ...subPackage, slots: subPackage.slots.filter((_, index) => index !== slotIndex) })} />)}
      <p className="form-help">เพิ่ม slot อย่างน้อยหนึ่งรายการต่อ Sub Package</p>
    </article>)}
    <button className="button button-primary" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกประเภทนี้"}</button>
    {message && <p className={message === "บันทึกแพ็กเกจแล้ว" ? "success-message" : "error-message"} role="status">{message}</p>}
  </form>;
}

function SlotEditor({ slot, requiredCountDraft, onRequiredCountChange, services, onChange, onRemove }: { slot: PackageSlot; requiredCountDraft: string; onRequiredCountChange: (value: string) => void; services: PackageService[]; onChange: (slot: PackageSlot) => void; onRemove: () => void }) {
  const allowed = services.filter((service) => service.category === slot.service_category);
  return <fieldset className="package-slot package-slot-edit">
    <div className="package-editor-heading"><legend>Slot</legend><button className="text-button" type="button" onClick={onRemove}>ลบ slot</button></div>
    <label className="field"><span>ชื่อ slot <span className="required-marker" aria-hidden="true">*</span></span><input maxLength={100} value={slot.name} onChange={(event) => onChange({ ...slot, name: event.target.value })} required /></label>
    <div className="coordinate-fields">
      <label className="field"><span>ชนิดบริการ <span className="required-marker" aria-hidden="true">*</span></span><select required value={slot.service_category} onChange={(event) => onChange({ ...slot, service_category: event.target.value as PackageSlot["service_category"], service_ids: [] })}>
        <option value="community_product">สินค้าชุมชน</option><option value="accommodation">ที่พัก</option><option value="restaurant">ร้านอาหาร</option><option value="tourism_trail">ท่องเที่ยว / เส้นทางเดินป่า</option><option value="other">อื่น ๆ</option>
      </select></label>
      <label className="field"><span>จำนวนที่ต้องเลือก <span className="required-marker" aria-hidden="true">*</span></span><input type="text" inputMode="numeric" maxLength={2} pattern="[0-9]{1,2}" value={requiredCountDraft} onChange={(event) => onRequiredCountChange(event.currentTarget.value)} required /></label>
    </div>
    <fieldset className="package-service-options"><legend>บริการที่เลือกได้ <span className="required-marker" aria-hidden="true">*</span> ({allowed.length})</legend>
      {allowed.length ? allowed.map((service) => <label className="package-choice" key={service.id}><input type="checkbox" checked={slot.service_ids.includes(service.id)} onChange={(event) => onChange({ ...slot, service_ids: event.target.checked ? [...slot.service_ids, service.id] : slot.service_ids.filter((id) => id !== service.id) })} /><span>{service.name}</span></label>) : <p className="form-help">ยังไม่มี Staff ที่อนุมัติแล้วซึ่งมีบริการตรงประเภทนี้</p>}
    </fieldset>
    <p className="form-help">เลือกบริการอย่างน้อย {requiredCountDraft} รายการตามจำนวนที่ต้องเลือก ({slot.service_ids.length} รายการกำหนดไว้)</p>
  </fieldset>;
}
