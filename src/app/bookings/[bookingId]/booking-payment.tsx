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
      <h2>QR Payment จำลอง</h2>
      <p className="error-message">DEMO เท่านั้น · QR ตัวอย่างนี้สแกนชำระเงินจริงไม่ได้ และระบบไม่ได้ตรวจสอบยอดกับธนาคาร</p>
      <svg className="demo-qr" viewBox="0 0 120 120" role="img" aria-label="ลวดลาย QR ตัวอย่างที่ใช้ชำระเงินจริงไม่ได้">
        <rect width="120" height="120" fill="white" />
        <path fill="#20352b" d="M8 8h36v36H8zm8 8v20h20V16zm60-8h36v36H76zm8 8v20h20V16zM8 76h36v36H8zm8 8v20h20V84zM52 8h8v8h-8zm8 16h8v8h-8zm-8 16h16v8H52zm8 12h8v8h-8zm16 0h8v8h-8zm16 0h8v8h-8zm20 0h8v8h-8zM48 60h8v8h-8zm16 0h8v8h-8zm16 0h8v8h-8zm16 0h8v8h-8zM52 76h8v8h-8zm16 0h8v8h-8zm16 8h8v8h-8zm16-8h8v8h-8zm-40 16h8v8h-8zm16 8h8v8h-8zm16 4h8v8h-8zm16-8h8v8h-8z" />
        <text x="60" y="116" textAnchor="middle" fontSize="6" fill="#a23b34">DEMO</text>
      </svg>
      <label className="package-choice"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>ฉันเข้าใจว่านี่เป็นการสาธิตและไม่มีการโอนเงินจริง <span className="required-marker" aria-hidden="true">*</span></span></label>
      <button className="button button-primary" type="button" disabled={busy || !acknowledged} onClick={() => void post(`/api/bookings/${booking.id}/confirm`)}>{busy ? "กำลังบันทึก…" : "ยืนยันจ่ายเงินจำลอง"}</button>
    </> : <>
      <h2>ยืนยันจ่ายเงินจำลองแล้ว</h2><p>ไม่มีการรับเงินจริงหรือการตรวจยอดจากธนาคาร</p>
      {booking.my_trip_added_at ? <p className="success-message">เพิ่มสถานที่จากแพ็กเกจเข้า My Trip แล้ว</p> : <button className="button button-primary" type="button" disabled={busy} onClick={() => void post(`/api/bookings/${booking.id}/my-trip`)}>{busy ? "กำลังเพิ่ม…" : "เพิ่มสถานที่ทั้งหมดเข้า My Trip"}</button>}
    </>}
    {message && <p className={failed ? "error-message" : "success-message"} role="status">{message}</p>}
  </section>;
}
