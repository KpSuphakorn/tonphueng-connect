"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { CustomerCart } from "../../lib/product-types";
import { Icon } from "../components/icons";
import { clearDraft, readDraft, writeDraft } from "../components/session-draft";

type FulfillmentDraft = { fulfillment: "pickup" | "delivery"; address: string };
const draftKey = (serviceId: string) => `cart-fulfillment:${serviceId}`;

type UnavailableCart = { available: false; service_id: string; store_name: string; items: Array<{ product_id: string; quantity: number }> };
type CartState = CustomerCart | UnavailableCart;
const money = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(value / 100);

export function CartForm() {
  const router = useRouter();
  // One checkout attempt per cart fingerprint: retries after a lost response reuse the request UUID and skip a repeated save.
  const [checkout, setCheckout] = useState<{ fingerprint: string; requestId: string; saved: boolean } | null>(null);
  const [navigating, startNavigation] = useTransition();
  const [checkoutAttempted, setCheckoutAttempted] = useState(false);
  const [cart, setCart] = useState<CartState | null>(null);
  const [items, setItems] = useState<Array<{ product_id: string; quantity: number; name?: string; price_satang?: number }>>([]);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function load() {
    setLoading(true); setError(""); setLoginRequired(false);
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      const result = await response.json() as { cart?: CartState | null; error?: string };
      if (response.status === 403) { setLoginRequired(true); setCart(null); return; }
      if (!response.ok) throw new Error(result.error || "โหลดตะกร้าไม่สำเร็จ");
      setCart(result.cart ?? null);
      if (result.cart) {
        setItems(result.cart.items.map((item) => ({ ...item })));
        const saved: FulfillmentDraft = { fulfillment: "fulfillment" in result.cart ? result.cart.fulfillment : "pickup", address: "address" in result.cart ? result.cart.address : "" };
        // An unsaved delivery choice/address typed this session is restored only on top of the same saved cart values.
        const draft = result.cart.available ? readDraft<FulfillmentDraft>(draftKey(result.cart.service_id), saved) : undefined;
        setFulfillment(draft?.fulfillment ?? saved.fulfillment);
        setAddress(draft?.address ?? saved.address);
      } else setItems([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดตะกร้าไม่สำเร็จ"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!cart || !cart.available) return;
    const saved: FulfillmentDraft = { fulfillment: cart.fulfillment, address: cart.address };
    const current: FulfillmentDraft = { fulfillment, address: fulfillment === "delivery" ? address : "" };
    if (current.fulfillment === saved.fulfillment && current.address === saved.address) clearDraft(draftKey(cart.service_id));
    else writeDraft(draftKey(cart.service_id), current, saved);
  }, [cart, fulfillment, address]);

  async function save() {
    if (!cart || !items.length || !cart.available) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        service_id: cart.service_id, items: items.map(({ product_id, quantity }) => ({ product_id, quantity })), fulfillment,
        address: fulfillment === "delivery" ? address : "",
      }), cache: "no-store" });
      const result = await response.json() as { cart?: CustomerCart; error?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกตะกร้าไม่สำเร็จ");
      setCart(result.cart ?? null); setItems(result.cart?.items ?? []); setCheckout(null); setNotice("บันทึกตะกร้าแล้ว ยอดคำนวณจากข้อมูลสินค้าปัจจุบัน");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกตะกร้าไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function clear() {
    if (!cart) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/cart", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true, expected_service_id: cart.service_id }), cache: "no-store" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "ล้างตะกร้าไม่สำเร็จ");
      clearDraft(draftKey(cart.service_id));
      setCart(null); setItems([]); setConfirmClear(false); setCheckout(null); setNotice("ล้างตะกร้าแล้ว");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ล้างตะกร้าไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  /** Saves the current cart (server reprices it) and creates the Order in one click. */
  async function placeOrder() {
    if (!cart || !cart.available) return;
    setCheckoutAttempted(true);
    if (addressInvalid || quantitiesInvalid) return;
    const payload = { service_id: cart.service_id, items: items.map(({ product_id, quantity }) => ({ product_id, quantity })), fulfillment, address: fulfillment === "delivery" ? address : "" };
    const fingerprint = JSON.stringify(payload);
    let attempt = checkout?.fingerprint === fingerprint ? checkout : { fingerprint, requestId: crypto.randomUUID(), saved: !dirty };
    setCheckout(attempt); setBusy(true); setError(""); setNotice("");
    try {
      if (!attempt.saved) {
        const saved = await fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: fingerprint, cache: "no-store" });
        const savedResult = await saved.json() as { cart?: CustomerCart; error?: string };
        if (!saved.ok || !savedResult.cart) { setCheckout(null); throw new Error(savedResult.error || "บันทึกตะกร้าไม่สำเร็จ"); }
        setCart(savedResult.cart); setItems(savedResult.cart.items);
        attempt = { ...attempt, saved: true };
        setCheckout(attempt);
      }
      const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request_id: attempt.requestId, expected_service_id: cart.service_id }), cache: "no-store" });
      const result = await response.json() as { order?: { id: string }; error?: string; code?: string };
      if (!response.ok || !result.order) {
        if (result.code) setCheckout(null);
        throw new Error(result.error || "สร้างคำสั่งซื้อไม่สำเร็จ");
      }
      const orderId = result.order.id;
      clearDraft(draftKey(cart.service_id));
      startNavigation(() => router.push(`/orders/${orderId}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "สร้างคำสั่งซื้อไม่สำเร็จ"); setBusy(false); }
  }

  if (loading) return <div aria-busy="true"><p role="status" className="form-help">กำลังโหลดตะกร้า…</p><div className="skeleton" /><div className="skeleton" /></div>;
  if (loginRequired) return <section className="note-card"><strong>เข้าสู่ระบบด้วย LINE เพื่อใช้ตะกร้า</strong><p><Link className="text-link" href="/login">ไปหน้าเข้าสู่ระบบ</Link></p></section>;
  if (error && !cart) return <section className="action-row"><p role="alert" className="error-message">{error}</p><button className="button button-secondary" type="button" onClick={() => void load()}>โหลดอีกครั้ง</button></section>;
  if (!cart) return <section className="note-card"><strong>ตะกร้ายังว่าง</strong><p>เลือกร้านสินค้าชุมชนเพื่อเพิ่มสินค้า</p><Link className="button button-primary" href="/products">เลือกร้าน</Link></section>;

  const dirty = !cart.available || fulfillment !== cart.fulfillment || (fulfillment === "delivery" ? address : "") !== cart.address
    || items.length !== cart.items.length || items.some((item) => cart.items.find((line) => line.product_id === item.product_id)?.quantity !== item.quantity);
  const addressInvalid = fulfillment === "delivery" && address.trim().length < 5;
  const quantitiesInvalid = !items.length || items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99);
  const pending = busy || navigating;

  return <section className="cart-panel" aria-labelledby="cart-store-heading">
    <div className="cart-store"><span className="store-icon"><Icon name="store" /></span><h2 id="cart-store-heading">{cart.store_name}</h2></div>
    {!cart.available ? <><p className="error-message" role="alert">รายการในตะกร้าหมดหรือร้านไม่เปิดใช้งานแล้ว ยอดเดิมใช้ไม่ได้ กรุณาล้างตะกร้าก่อนเลือกสินค้าใหม่</p><button type="button" className="button button-secondary" onClick={() => setConfirmClear(true)}>ล้างตะกร้า</button></> : <>
      <ul className="cart-line-list">{items.map((item) => <li key={item.product_id}>
        <span className="cart-line-name"><strong>{item.name}</strong><small>{money(item.price_satang ?? 0)} ต่อชิ้น</small></span>
        <label className="field">จำนวน<input aria-label={`จำนวน ${item.name}`} type="number" inputMode="numeric" min="1" max="99" value={item.quantity} onChange={(event) => setItems((current) => current.map((line) => line.product_id === item.product_id ? { ...line, quantity: Number(event.target.value) } : line))} /></label>
        <button type="button" className="text-button" aria-label={`ลบ ${item.name} จากตะกร้า`} onClick={() => setItems((current) => current.filter((line) => line.product_id !== item.product_id))}>ลบ</button>
      </li>)}</ul>
      <fieldset className="cart-fulfillment"><legend>วิธีรับสินค้า</legend>
        <label className="package-choice"><input type="radio" name="fulfillment" value="pickup" checked={fulfillment === "pickup"} onChange={() => { setFulfillment("pickup"); setAddress(""); }} />รับที่ร้าน · ไม่มีค่าส่ง</label>
        <label className="package-choice"><input type="radio" name="fulfillment" value="delivery" checked={fulfillment === "delivery"} onChange={() => setFulfillment("delivery")} />จัดส่ง · ค่าส่ง ฿50.00</label>
      </fieldset>
      {fulfillment === "delivery" && <><label className="field"><span>ที่อยู่จัดส่ง <span className="required-marker" aria-hidden="true">*</span></span><textarea required minLength={5} maxLength={500} value={address} aria-invalid={checkoutAttempted && addressInvalid} aria-describedby="address-help" onChange={(event) => setAddress(event.target.value)} /></label>{checkoutAttempted && addressInvalid ? <p id="address-help" className="error-message" role="alert">กรุณากรอกที่อยู่จัดส่งอย่างน้อย 5 ตัวอักษร</p> : <p id="address-help" className="form-help"><span className="required-marker" aria-hidden="true">*</span> จำเป็นต้องกรอก</p>}</>}
      <dl className="cart-total-list"><div><dt>ราคาสินค้าในตะกร้าล่าสุด</dt><dd>{money(cart.subtotal_satang)}</dd></div><div><dt>ค่าส่ง</dt><dd>{money(cart.shipping_satang)}{cart.fulfillment === "delivery" && <small> ค่าส่งคงที่</small>}</dd></div><div className="cart-grand-total"><dt>ยอดรวมปัจจุบัน</dt><dd>{money(cart.total_satang)}</dd></div></dl>
      <p className="form-help">{dirty ? "มีการแก้ไขที่ยังไม่บันทึก ยอดจะคำนวณใหม่ในระบบเมื่อกดสั่งซื้อ และแสดงให้ตรวจก่อนชำระเงิน" : "ยอดที่แสดงคำนวณจากราคาสินค้าปัจจุบันในระบบ"}</p>
      {error && <p role="alert" className="error-message">{error}</p>}{notice && <p role="status" className="success-message">{notice}</p>}
      <div className="action-bar"><button type="button" className="button button-primary button-wide" disabled={pending} aria-busy={pending} onClick={() => void placeOrder()}>{pending ? "กำลังสั่งซื้อ…" : "สั่งซื้อ"}</button></div>
      <div className="product-form-actions"><button type="button" className="button button-secondary" disabled={pending || quantitiesInvalid || addressInvalid} onClick={() => void save()}>{busy ? "กำลังบันทึก…" : "บันทึกตะกร้าและคำนวณใหม่"}</button><button type="button" className="button button-secondary" disabled={pending} onClick={() => setConfirmClear(true)}>ล้างตะกร้า</button></div>
    </>}
    {confirmClear && <div className="switch-confirmation" role="alertdialog" aria-labelledby="clear-cart-title"><h3 id="clear-cart-title">ล้างรายการในตะกร้า?</h3><p>สินค้าจากร้านนี้จะถูกนำออกจากตะกร้า</p><div className="product-form-actions"><button type="button" className="button button-primary" disabled={busy} onClick={() => void clear()}>ยืนยันล้างตะกร้า</button><button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirmClear(false)}>เก็บตะกร้าไว้</button></div></div>}
  </section>;
}
