"use client";

import { useState } from "react";
import type { OrderStatus, ProductOrder, StaffOrderStatus } from "../../../lib/orders";

type Props = { order: ProductOrder; labels: Record<OrderStatus, string>; statuses: readonly StaffOrderStatus[] };

export function OrderStatusForm({ order: initial, labels, statuses }: Props) {
  const [order, setOrder] = useState(initial);
  const currentRank = ["paid", ...statuses].indexOf(order.status);
  const [status, setStatus] = useState<StaffOrderStatus>(statuses.includes(order.status as StaffOrderStatus) ? order.status as StaffOrderStatus : "preparing");
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function save() {
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch(`/api/staff/orders/${order.id}`, { method: "PATCH", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, tracking_number: order.fulfillment === "delivery" ? tracking : "" }) });
      const result = await response.json() as { error?: string; order?: ProductOrder; message?: string };
      if (!response.ok || !result.order) throw new Error(result.error || "บันทึกสถานะไม่สำเร็จ");
      setOrder(result.order); setTracking(result.order.tracking_number ?? ""); setMessage(result.message || "บันทึกสถานะแล้ว");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "บันทึกสถานะไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <p><strong>สถานะปัจจุบัน:</strong> {labels[order.status]}{order.tracking_number && <> · เลขพัสดุ {order.tracking_number}</>}</p>
    <label className="field">อัปเดตสถานะ
      <select value={status} onChange={(event) => setStatus(event.target.value as StaffOrderStatus)}>
        {statuses.map((value, index) => <option key={value} value={value} disabled={index + 1 < currentRank}>{labels[value]}</option>)}
      </select>
    </label>
    {order.fulfillment === "delivery" ? <label className="field">เลขพัสดุ (Tracking Number ไม่บังคับ)
      <input value={tracking} maxLength={60} autoComplete="off" onChange={(event) => setTracking(event.target.value)} />
    </label> : <p className="form-help">ลูกค้ารับที่ร้าน ไม่ต้องกรอกเลขพัสดุ</p>}
    <button className="button button-primary" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกสถานะ"}</button>
    {message && <p className={failed ? "error-message" : "success-message"} role="status">{message}</p>}
  </form>;
}
