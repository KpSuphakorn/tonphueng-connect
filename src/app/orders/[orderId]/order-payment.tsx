"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProductOrder } from "../../../lib/orders";

export function OrderPayment({ order: initial }: { order: ProductOrder }) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  async function confirm() {
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch(`/api/orders/${order.id}/confirm`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: "{}" });
      const result = await response.json() as { error?: string; order?: ProductOrder; message?: string };
      if (!response.ok || !result.order) throw new Error(result.error || "ยืนยันไม่สำเร็จ");
      setOrder(result.order); setMessage(result.message || "ชำระเงินเรียบร้อย"); startRefresh(() => router.refresh());
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "ยืนยันไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <section className="section booking-payment">
    {order.payment_status === "pending_simulated" ? <>
      <h2>ชำระเงินผ่าน QR</h2>
      <p className="form-help">สแกน QR เพื่อชำระเงิน</p>
      <img className="demo-qr" src="/demo-qr.png" width={144} height={144} alt="QR สำหรับชำระเงิน" />
      <label className="package-choice"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>ฉันตรวจสอบรายการและยอดชำระแล้ว <span className="required-marker" aria-hidden="true">*</span></span></label>
      <button className="button button-primary" type="button" disabled={busy || refreshing || !acknowledged} aria-busy={busy} onClick={() => void confirm()}>{busy ? "กำลังยืนยัน…" : "ยืนยันการชำระเงิน"}</button>
    </> : <>
      <h2>ชำระเงินเรียบร้อย</h2>
      <p>ร้านจะเห็นคำสั่งซื้อนี้ในรายการงาน</p>
      <Link className="button button-secondary" href="/my-order">ติดตามใน My Order</Link>
    </>}
    {message && <p className={failed ? "error-message" : "success-message"} role="status">{message}</p>}
  </section>;
}
