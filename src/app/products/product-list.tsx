"use client";

import Link from "next/link";
import { useState } from "react";
import type { CustomerCart, Product } from "../../lib/product-types";

type UnavailableCart = { available: false; service_id: string; store_name: string; items: Array<{ product_id: string; quantity: number }> };
function money(value: number) { return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(value / 100); }

export function ProductList({ serviceId, storeName, products }: { serviceId: string; storeName: string; products: Product[] }) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [switchCart, setSwitchCart] = useState<{ serviceId: string; storeName: string; product: Product; quantity: number } | null>(null);

  async function add(product: Product) {
    setBusy(true); setError(""); setNotice(""); setSwitchCart(null);
    const raw = quantities[product.id] ?? "1";
    const quantity = raw ? Number(raw) : Number.NaN;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) { setError("จำนวนสินค้าต้องอยู่ระหว่าง 1 ถึง 99 ชิ้น"); setBusy(false); return; }
    try {
      const currentResponse = await fetch("/api/cart", { cache: "no-store" });
      const currentResult = await currentResponse.json() as { cart?: CustomerCart | UnavailableCart | null; error?: string };
      if (!currentResponse.ok) throw new Error(currentResult.error || "เข้าสู่ระบบด้วย LINE ก่อนเพิ่มสินค้า");
      const current = currentResult.cart;
      if (current && current.service_id !== serviceId) {
        setSwitchCart({ serviceId: current.service_id, storeName: current.store_name, product, quantity });
        return;
      }
      if (current && "available" in current && !current.available) throw new Error("ตะกร้าเดิมมีสินค้าที่ไม่พร้อมแล้ว กรุณาเปิดตะกร้าและล้างก่อนเพิ่มสินค้า");
      const items = current ? [...current.items.map(({ product_id, quantity: count }) => ({ product_id, quantity: count }))] : [];
      const found = items.find((item) => item.product_id === product.id);
      if (found) found.quantity = Math.min(99, found.quantity + quantity);
      else items.push({ product_id: product.id, quantity });
      const saved = await fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: serviceId, items, fulfillment: current?.fulfillment ?? "pickup", address: current?.address ?? "" }), cache: "no-store" });
      const result = await saved.json() as { error?: string };
      if (!saved.ok) throw new Error(result.error || "บันทึกตะกร้าไม่สำเร็จ");
      setNotice(`${product.name} อยู่ในตะกร้าแล้ว`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เพิ่มสินค้าไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function confirmSwitch() {
    if (!switchCart) return;
    setBusy(true); setError("");
    try {
      const cleared = await fetch("/api/cart", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true, expected_service_id: switchCart.serviceId }), cache: "no-store" });
      const clearResult = await cleared.json() as { error?: string };
      if (!cleared.ok) throw new Error(clearResult.error || "ล้างตะกร้าเดิมไม่สำเร็จ");
      const saved = await fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service_id: serviceId, items: [{ product_id: switchCart.product.id, quantity: switchCart.quantity }], fulfillment: "pickup", address: "" }), cache: "no-store" });
      const result = await saved.json() as { error?: string };
      if (!saved.ok) throw new Error(result.error || "เพิ่มสินค้าไม่สำเร็จ");
      setNotice(`เปลี่ยนมาใช้ตะกร้าร้าน ${storeName} แล้ว`); setSwitchCart(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เปลี่ยนร้านไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return <section aria-label={`สินค้าจากร้าน ${storeName}`}>
    {error && <p className="error-message sticky-message" role="alert">{error}</p>}{notice && <p className="success-message sticky-message" role="status">{notice} · <Link className="text-link" href="/cart">ดูตะกร้า</Link></p>}
    {switchCart && <section className="switch-confirmation" role="alertdialog" aria-labelledby="switch-cart-title" aria-describedby="switch-cart-copy">
      <h2 id="switch-cart-title">เปลี่ยนร้านในตะกร้า?</h2><p id="switch-cart-copy">ตะกร้าปัจจุบันมีสินค้า {switchCart.storeName} การเปลี่ยนร้านจะล้างรายการเดิม แล้วเพิ่ม {switchCart.product.name} จากร้าน {storeName}</p>
      <div className="product-form-actions"><button className="button button-primary" type="button" disabled={busy} onClick={() => void confirmSwitch()}>ล้างและเปลี่ยนร้าน</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => setSwitchCart(null)}>เก็บตะกร้าเดิม</button></div>
    </section>}
    {products.length ? <ul className="public-product-list">{products.map((product) => <li className="public-product-row" key={product.id}>
      <img src={product.photo_url} alt={`รูป ${product.name}`} loading="lazy" />
      <div className="public-product-copy"><h2>{product.name}</h2>{product.description && <p>{product.description}</p>}<strong>{money(product.price_satang)}</strong></div>
      <div className="product-add-row"><label className="field">จำนวน<input aria-label={`จำนวน ${product.name}`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} autoComplete="off" value={quantities[product.id] ?? "1"} onChange={(event) => { const raw = event.target.value.replace(/[^0-9]/g, ""); setQuantities((current) => ({ ...current, [product.id]: raw })); }} /></label><button type="button" className="button button-primary" disabled={busy} onClick={() => void add(product)}>เพิ่มลงตะกร้า</button></div>
    </li>)}</ul> : <p className="note-card">ร้านนี้ยังไม่มีสินค้าให้เลือก</p>}
  </section>;
}
