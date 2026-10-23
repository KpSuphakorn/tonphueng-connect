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
      setOrder(result.order); setMessage(result.message || "ยืนยันจ่ายเงินจำลองแล้ว"); startRefresh(() => router.refresh());
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "ยืนยันไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <section className="section booking-payment">
    {order.payment_status === "pending_simulated" ? <>
      <h2>QR Payment จำลอง</h2>
      <p className="error-message">DEMO เท่านั้น · QR ตัวอย่างนี้สแกนชำระเงินจริงไม่ได้ ไม่มีการรับเงินจริง และระบบไม่ได้ตรวจสอบยอดกับธนาคาร</p>
      <svg className="demo-qr" viewBox="0 0 120 120" role="img" aria-label="ลวดลาย QR ตัวอย่างที่ใช้ชำระเงินจริงไม่ได้">
        <rect width="120" height="120" fill="white" />
        <path fill="#20352b" d="M8 8h36v36H8zm8 8v20h20V16zm60-8h36v36H76zm8 8v20h20V16zM8 76h36v36H8zm8 8v20h20V84zM52 8h8v8h-8zm8 16h8v8h-8zm-8 16h16v8H52zm8 12h8v8h-8zm16 0h8v8h-8zm16 0h8v8h-8zm20 0h8v8h-8zM48 60h8v8h-8zm16 0h8v8h-8zm16 0h8v8h-8zm16 0h8v8h-8zM52 76h8v8h-8zm16 0h8v8h-8zm16 8h8v8h-8zm16-8h8v8h-8zm-40 16h8v8h-8zm16 8h8v8h-8zm16 4h8v8h-8zm16-8h8v8h-8z" />
        <text x="60" y="116" textAnchor="middle" fontSize="6" fill="#a23b34">DEMO</text>
      </svg>
      <label className="package-choice"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>ฉันเข้าใจว่านี่เป็นการสาธิตและไม่มีการโอนเงินจริง <span className="required-marker" aria-hidden="true">*</span></span></label>
      <button className="button button-primary" type="button" disabled={busy || refreshing || !acknowledged} aria-busy={busy} onClick={() => void confirm()}>{busy ? "กำลังยืนยัน…" : "ยืนยันจ่ายเงินจำลอง"}</button>
    </> : <>
      <h2>ยืนยันจ่ายเงินจำลองแล้ว</h2>
      <p>ผลนี้เป็นการจำลองเท่านั้น ไม่มีการรับเงินจริงหรือการตรวจยอดจากธนาคาร ร้านจะเห็นคำสั่งซื้อนี้ในรายการงาน</p>
      <Link className="button button-secondary" href="/my-order">ติดตามใน My Order</Link>
    </>}
    {message && <p className={failed ? "error-message" : "success-message"} role="status">{message}</p>}
  </section>;
}
