"use client";

import { useState } from "react";
import type { CatalogRow, PackageCatalog, PackageService, PackageSlot, SubPackage } from "../../../lib/packages";

const packageCategories = [
  { id: "trail_running", title: "Trail & Running" },
  { id: "wildfire_study", title: "Wild Fire Study" },
  { id: "cultural_study_trip", title: "Cultural Study Trip" },
] as const;

function newSubPackage(): SubPackage {
  return { id: crypto.randomUUID(), title: "", description: "", price_per_person_satang: 0, slots: [] };
}

function priceInput(satang: number) {
  if (satang <= 0) return "";
  return `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, "0")}`;
}

function priceInSatang(value: string) {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) return 0;
  const [baht, satang = ""] = value.split(".");
  return Number(baht) * 100 + Number(satang.padEnd(2, "0"));
}

export function PackageEditor({ initialCatalogs, services }: { initialCatalogs: CatalogRow[]; services: PackageService[] }) {
  const [catalogs, setCatalogs] = useState(initialCatalogs);
  const [selected, setSelected] = useState(initialCatalogs[0]?.category ?? packageCategories[0].id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const current = catalogs.find((item) => item.category === selected)!;
  const update = (catalog: PackageCatalog) => setCatalogs((items) => items.map((item) => item.category === selected ? { ...item, catalog } : item));
  const updateSub = (index: number, subPackage: SubPackage) => update({ ...current.catalog, sub_packages: current.catalog.sub_packages.map((item, itemIndex) => itemIndex === index ? subPackage : item) });
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/packages", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: selected, revision: current.revision, catalog: current.catalog }) });
      const result = await response.json() as { error?: string; revision?: number };
      if (!response.ok) throw new Error(result.error || "บันทึกแพ็กเกจไม่สำเร็จ");
      setCatalogs((items) => items.map((item) => item.category === selected ? { ...item, revision: result.revision ?? item.revision } : item));
      setMessage("บันทึกแพ็กเกจแล้ว");
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกแพ็กเกจไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <section className="package-editor">
    <label className="field">ประเภทแพ็กเกจ<select value={selected} onChange={(event) => { setSelected(event.target.value as typeof selected); setMessage(""); }}>
      {packageCategories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
    </select></label>
    <div className="package-edit-panel">
      <label className="field">ชื่อ Package<input maxLength={160} value={current.catalog.title} onChange={(event) => update({ ...current.catalog, title: event.target.value })} required /></label>
      <label className="field">รายละเอียด Package<textarea maxLength={4000} value={current.catalog.description} onChange={(event) => update({ ...current.catalog, description: event.target.value })} /></label>
      <label className="field">ลิงก์สอบถามแพ็กเกจเพิ่มเติม (HTTPS)<input type="url" maxLength={500} placeholder="https://..." value={current.catalog.contact_url} onChange={(event) => update({ ...current.catalog, contact_url: event.target.value })} /></label>
    </div>
    <div className="package-editor-heading"><h2>Sub Packages</h2><button className="button button-secondary" type="button" onClick={() => update({ ...current.catalog, sub_packages: [...current.catalog.sub_packages, newSubPackage()] })}>เพิ่ม Sub Package</button></div>
    {current.catalog.sub_packages.map((subPackage, subIndex) => <article className="package-edit-panel" key={subPackage.id}>
      <div className="package-editor-heading"><h3>Sub Package {subIndex + 1}</h3><button className="text-button" type="button" onClick={() => update({ ...current.catalog, sub_packages: current.catalog.sub_packages.filter((_, index) => index !== subIndex) })}>ลบ</button></div>
      <label className="field">ชื่อ Sub Package<input maxLength={160} value={subPackage.title} onChange={(event) => updateSub(subIndex, { ...subPackage, title: event.target.value })} required /></label>
      <label className="field">รายละเอียด<textarea maxLength={4000} value={subPackage.description} onChange={(event) => updateSub(subIndex, { ...subPackage, description: event.target.value })} /></label>
      <label className="field">ราคาต่อคน (บาท)<input type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" value={priceInput(subPackage.price_per_person_satang)} onChange={(event) => updateSub(subIndex, { ...subPackage, price_per_person_satang: priceInSatang(event.target.value) })} required /><small>ระบุราคาตัวอย่างต่อคน; ระบบเก็บเป็นสตางค์จำนวนเต็ม</small></label>
      <div className="package-editor-heading"><h4>ตัวเลือกตาม slot</h4><button className="button button-secondary" type="button" onClick={() => updateSub(subIndex, { ...subPackage, slots: [...subPackage.slots, { id: crypto.randomUUID(), name: "", service_category: "tourism_trail", required_count: 1, service_ids: [] }] })}>เพิ่ม slot</button></div>
      {subPackage.slots.map((slot, slotIndex) => <SlotEditor key={slot.id} slot={slot} services={services} onChange={(next) => updateSub(subIndex, { ...subPackage, slots: subPackage.slots.map((item, index) => index === slotIndex ? next : item) })} onRemove={() => updateSub(subIndex, { ...subPackage, slots: subPackage.slots.filter((_, index) => index !== slotIndex) })} />)}
    </article>)}
    <button className="button button-primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? "กำลังบันทึก…" : "บันทึกประเภทนี้"}</button>
    {message && <p className={message === "บันทึกแพ็กเกจแล้ว" ? "success-message" : "error-message"} role="status">{message}</p>}
  </section>;
}

function SlotEditor({ slot, services, onChange, onRemove }: { slot: PackageSlot; services: PackageService[]; onChange: (slot: PackageSlot) => void; onRemove: () => void }) {
  const allowed = services.filter((service) => service.category === slot.service_category);
  return <fieldset className="package-slot package-slot-edit">
    <div className="package-editor-heading"><legend>Slot</legend><button className="text-button" type="button" onClick={onRemove}>ลบ slot</button></div>
    <label className="field">ชื่อ slot<input maxLength={100} value={slot.name} onChange={(event) => onChange({ ...slot, name: event.target.value })} required /></label>
    <div className="coordinate-fields">
      <label className="field">ชนิดบริการ<select value={slot.service_category} onChange={(event) => onChange({ ...slot, service_category: event.target.value as PackageSlot["service_category"], service_ids: [] })}>
        <option value="community_product">สินค้าชุมชน</option><option value="accommodation">ที่พัก</option><option value="restaurant">ร้านอาหาร</option><option value="tourism_trail">ท่องเที่ยว / เส้นทางเดินป่า</option><option value="other">อื่น ๆ</option>
      </select></label>
      <label className="field">จำนวนที่ต้องเลือก<input type="number" min="1" max="10" step="1" value={slot.required_count} onChange={(event) => onChange({ ...slot, required_count: Number(event.target.value) })} required /></label>
    </div>
    <fieldset className="package-service-options"><legend>บริการที่เลือกได้ ({allowed.length})</legend>
      {allowed.length ? allowed.map((service) => <label className="package-choice" key={service.id}><input type="checkbox" checked={slot.service_ids.includes(service.id)} onChange={(event) => onChange({ ...slot, service_ids: event.target.checked ? [...slot.service_ids, service.id] : slot.service_ids.filter((id) => id !== service.id) })} /><span>{service.name}</span></label>) : <p className="form-help">ยังไม่มี Staff ที่อนุมัติแล้วซึ่งมีบริการตรงประเภทนี้</p>}
    </fieldset>
    <p className="form-help">ต้องเพิ่มบริการที่เลือกได้อย่างน้อยเท่าจำนวนที่ต้องเลือก ({slot.service_ids.length} รายการกำหนดไว้)</p>
  </fieldset>;
}
