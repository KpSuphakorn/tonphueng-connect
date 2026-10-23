# 07: ซื้อสินค้า -> Staff จัดการ -> Customer ติดตาม

**What to build:** Customer ยืนยันตะกร้าและจ่ายจำลองจนเกิด Order จริง Staff เจ้าของร้านรับงานและอัปเดตสถานะ/เลขพัสดุ แล้ว Customer ติดตามใน My Order ได้

**Blocked by:** 06: Staff ลงสินค้า -> Customer จัดตะกร้า.

**Status:** implementation-complete-awaiting-migration-and-live-acceptance

**Spec:** [Approved spec](../spec.md)

**Coverage:** User Stories 24-25, 31-33; AC13 และส่วน Order/การจ่ายจำลองของ AC14-AC15

## Acceptance criteria

- [x] Customer ตรวจสินค้า จำนวน วิธีรับ ที่อยู่ตามกรณี และยอดรวมที่คำนวณใหม่บน server ก่อนสร้าง Order ได้
- [x] การจ่ายเงินเป็น QR Payment จำลองที่บอกชัด ไม่มีการรับเงินจริงหรือรายงานว่าตรวจยอดธนาคารแล้ว
- [x] หลังยืนยันสำเร็จมี Order เดียวและผลการจ่ายจำลองชัดเจน การกดหรือส่งคำขอเดิมซ้ำไม่สร้าง Order/ผลสำเร็จซ้ำ
- [x] Staff เห็น Order ของร้านตนเป็นรายการงาน พร้อมสินค้าย่อย จำนวน รายละเอียด และข้อมูลรับหรือจัดส่ง
- [x] Staff อัปเดตสถานะกำลังเตรียมของ กำลังไปส่งของ ส่งของเรียบร้อยแล้ว และ Tracking Number ตามสเปกได้ โดยไม่บังคับเลขพัสดุเมื่อรับที่ร้าน
- [x] Customer เห็นรายการและสถานะล่าสุดใน My Order หลังเปิดใหม่; Customer อื่นและ Staff ร้านอื่นอ่านหรือแก้ Order ไม่ได้
- [x] ผ่านการทดสอบซื้อ -> จ่ายจำลอง -> Staff อัปเดต -> Customer ติดตาม รวมการแก้ยอด ข้ามเจ้าของ และส่งคำขอซ้ำ

## External prerequisites and evidence

- ใช้ค่าส่งและข้อมูลสินค้าเดโมที่กำหนดชัดเจนตาม ticket 06 และนโยบาย prototype ใน spec ได้ โดยบันทึก Order และคำนวณฝั่ง server จริง
- หากมีส่วนจ่ายจำลองที่ใช้ได้จาก ticket 05 ให้ใช้ต่อเท่าที่เหมาะสม แต่การซื้อสินค้าไม่มี dependency ทางพฤติกรรมที่ต้องรอการจองแพ็กเกจ
- Local implementation complete: migration `202610230008_product_orders.sql` is **not yet applied** to the connected Supabase project. Local PGlite, HTTP-double and browser evidence (including tracking rule: optional for delivery, rejected for pickup) is in the [Ticket 07 test report](../../../agent-runs/07-product-orders/test-report.md); live migration, real SQL/PostgREST probes and hosted Customer/Staff acceptance remain pending.
