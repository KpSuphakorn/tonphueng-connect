"use client";

import { useState } from "react";
import type { Booking } from "../../../lib/packages";

export function BookingPayment({ booking: initial }: { booking: Booking }) {
  const [booking, setBooking] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [failed, setFailed] = useState(false);
  async function post(path: string) {
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: "{}" });
      const result = await response.json() as { error?: string; booking?: Booking; message?: string };
      if (!response.ok || !result.booking) throw new Error(result.error || "ทำรายการไม่สำเร็จ");
      setBooking(result.booking); setMessage(result.message || "บันทึกแล้ว");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <section className="section booking-payment">
    {booking.status === "pending" ? <>
      <h2>ชำระเงินผ่าน QR</h2>
      <p className="form-help">สแกน QR เพื่อชำระเงิน</p>
      <img className="demo-qr" src="/demo-qr.png" width={144} height={144} alt="QR สำหรับชำระเงิน" />
      <label className="package-choice"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>ฉันตรวจสอบรายการและยอดชำระแล้ว <span className="required-marker" aria-hidden="true">*</span></span></label>
      <button className="button button-primary" type="button" disabled={busy || !acknowledged} onClick={() => void post(`/api/bookings/${booking.id}/confirm`)}>{busy ? "กำลังบันทึก…" : "ยืนยันการชำระเงิน"}</button>
    </> : <>
      <h2>ชำระเงินเรียบร้อย</h2>
      {booking.my_trip_added_at ? <p className="success-message">เพิ่มสถานที่จากแพ็กเกจเข้า My Trip แล้ว</p> : <button className="button button-primary" type="button" disabled={busy} onClick={() => void post(`/api/bookings/${booking.id}/my-trip`)}>{busy ? "กำลังเพิ่ม…" : "เพิ่มสถานที่ทั้งหมดเข้า My Trip"}</button>}
    </>}
    {message && <p className={failed ? "error-message" : "success-message"} role="status">{message}</p>}
  </section>;
}
