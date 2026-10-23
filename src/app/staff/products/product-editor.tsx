"use client";

import { useEffect, useState, type FormEvent } from "react";
import { uploadStaffPhotosDirectly } from "../photo-upload";
import type { Product } from "../../../lib/product-types";

function baht(value: number) { return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`; }
function satang(value: string) {
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 100_000_000 ? amount : null;
}

export function ProductEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState("");

  async function load() {
    const response = await fetch("/api/staff/products", { cache: "no-store" });
    const result = await response.json() as { products?: Product[]; error?: string };
    if (!response.ok) throw new Error(result.error || "โหลดสินค้าไม่สำเร็จ");
    setProducts(result.products ?? []);
  }
  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "โหลดสินค้าไม่สำเร็จ")); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function reset() { setEditing(null); setName(""); setDescription(""); setPrice(""); setFile(null); setPreview(""); }
  function edit(product: Product) { setEditing(product); setName(product.name); setDescription(product.description); setPrice(baht(product.price_satang)); setFile(null); setPreview(""); setError(""); setNotice(""); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const amount = satang(price);
    if (!name.trim() || !amount || (!editing && !file)) { setError("กรุณากรอกชื่อ ราคา และเลือกรูปสินค้า"); return; }
    setBusy(true);
    try {
      const uploadSession = file ? await uploadStaffPhotosDirectly([file], "product") : null;
      const form = new FormData();
      if (editing) form.set("id", editing.id);
      form.set("name", name); form.set("description", description); form.set("price_baht", price);
      form.set("upload_session", uploadSession ?? "");
      const response = await fetch("/api/staff/products", { method: editing ? "PUT" : "POST", body: form, cache: "no-store" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกสินค้าไม่สำเร็จ");
      reset(); await load(); setNotice("บันทึกสินค้าแล้ว");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกสินค้าไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function archive(product: Product) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/staff/products?id=${encodeURIComponent(product.id)}`, { method: "DELETE", headers: { "content-type": "application/json" }, cache: "no-store" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "นำสินค้าออกไม่สำเร็จ");
      if (editing?.id === product.id) reset();
      await load(); setNotice("นำสินค้าออกจากรายการแล้ว");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "นำสินค้าออกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return <div className="product-editor-layout">
    <form className="product-form" onSubmit={submit}>
      <h2>{editing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>
      <label className="field"><span>ชื่อสินค้า <span className="required-marker" aria-hidden="true">*</span></span><input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="field">รายละเอียด<textarea maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label className="field"><span>ราคา (บาท) <span className="required-marker" aria-hidden="true">*</span></span><input required inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="เช่น 120.00" aria-describedby="product-price-help" /></label>
      <p className="form-help" id="product-price-help">ใส่จำนวนบาทและไม่เกิน 2 ตำแหน่งทศนิยม</p>
      <label className="field"><span>รูปสินค้า {!editing && <span className="required-marker" aria-hidden="true">*</span>}</span><input required={!editing} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setPreview(next ? URL.createObjectURL(next) : ""); }} /></label>
      <p className="form-help"><span className="required-marker" aria-hidden="true">*</span> จำเป็นต้องกรอก</p>
      <p className="form-help">เลือกภาพเดียว ระบบจัดเก็บแบบส่วนตัวและปรับเป็น WebP</p>
      {(preview || editing?.photo_url) && <img className="product-editor-photo" src={preview || editing?.photo_url} alt="ตัวอย่างรูปสินค้า" />}
      {error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
      <div className="product-form-actions"><button className="button button-primary" disabled={busy}>{busy ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}</button>{editing && <button className="button button-secondary" type="button" disabled={busy} onClick={reset}>ยกเลิกการแก้ไข</button>}</div>
    </form>
    <section aria-labelledby="staff-product-list-heading">
      <div className="section-heading"><h2 id="staff-product-list-heading">รายการสินค้า</h2><p>{products.length} รายการ</p></div>
      {products.length ? <ul className="product-list">{products.map((product) => <li className="product-row" key={product.id}>
        {product.photo_url && <img src={product.photo_url} alt="" loading="lazy" />}
        <div className="product-row-copy"><strong>{product.name}</strong><span>{new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(product.price_satang / 100)}</span></div>
        <button type="button" className="text-button" onClick={() => edit(product)}>แก้ไข</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => void archive(product)}>นำออก</button>
      </li>)}</ul> : <p className="note-card">ยังไม่มีสินค้า</p>}
    </section>
  </div>;
}
