# 05: จอง -> จ่ายจำลอง -> Admin เห็น -> เข้า My Trip

**What to build:** Customer ระบุวันและจำนวนคน ยืนยันแพ็กเกจด้วยการจ่ายเงินจำลอง Admin เห็น Booking จริง และ Customer เพิ่มสถานที่ในแพ็กเกจเข้า My Trip ได้

**Blocked by:** 04: Admin จัดแพ็กเกจ -> Customer เลือก slot.

**Status:** implementation-complete-awaiting-live-acceptance

**Evidence:** [Local validation and remaining acceptance](../../../agent-runs/05-package-booking/test-report.md)

**Spec:** [Approved spec](../spec.md)

**Coverage:** User Stories 8-12, 37; AC09, ส่วน Booking ของ AC10 และ AC14-AC15

## Acceptance criteria

- [x] Customer ระบุวัน จำนวนผู้เข้าร่วม และรายละเอียดจำเป็นตามแพ็กเกจ พร้อมตรวจตัวเลือกและยอดรวมก่อนยืนยันได้
- [x] Server ตรวจตัวเลือก จำนวนคน และคำนวณจากราคาหรือสูตรที่ยืนยัน ไม่เชื่อยอดที่ browser ส่งมา
- [x] ขั้นตอน QR Payment ระบุชัดว่าเป็นการจำลอง ไม่เรียกเก็บเงินจริงหรือกล่าวว่าตรวจยอดกับธนาคารแล้ว
- [x] ยืนยันจ่ายจำลองแล้วบันทึก Booking เดียวที่มีเจ้าของ รายละเอียด ราคา และผลจำลองชัดเจน; คำขอซ้ำไม่สร้างรายการซ้ำ
- [x] Admin เห็นรายละเอียด Booking ที่เข้ามา Customer เปิดข้อมูลของตนหลังเข้าใหม่ได้ และบัญชีอื่นอ่านหรือแก้รายการนั้นไม่ได้
- [x] หลังจ่ายจำลองสำเร็จ Customer เพิ่มสถานที่ทั้งหมดของ Sub Package เข้า My Trip ได้ และแยกจากสถานที่ที่บันทึกเอง
- [x] เก็บรายละเอียดการจองและข้อมูลวันจบทริปตามข้อมูลแพ็กเกจที่ยืนยัน เพื่ออ่านรายการเดิมและใช้ขอ Feedback ได้ถูกต้อง
- [x] ผ่านการทดสอบเลือก -> ตรวจราคา -> จ่ายจำลอง -> Admin เห็น -> My Trip รวมแก้ราคา/เจ้าของและส่งคำขอซ้ำ

รายการข้างต้นผ่านในเครื่องด้วย HTTP doubles, browser flow และ PGlite SQL probes รวมถึง SQL/RPC probes บน Supabase จริงที่ rollback ข้อมูลทดสอบแล้ว; ยังไม่ใช่ผลตรวจรับ Booking ผ่าน LINE/Vercel ครบ flow

## External prerequisites and evidence

- ตรวจรับด้วยสูตรราคา วันที่ให้บริการ ระยะเวลา และรายละเอียดเดโมตามนโยบาย prototype ใน spec ได้ ไม่ใช้วันจองหรือวันจ่ายแทนวันจบทริป
- ข้อมูลธุรกิจจริงไม่เป็น blocker ของต้นแบบ แต่ integration ที่จำเป็นของงานหลักยังต้องตรวจรับจริง; ไม่ต้องรอ optional Tickets 09–10
- Migration 006 ใช้กับฐานจริงเมื่อ 2026-10-23 ตามที่เจ้าของอนุญาตแล้ว; SQL probes ผ่านและ rollback ข้อมูลทดสอบทั้งหมด PostgREST เห็นตาราง/RPC ใหม่แล้ว ยังรอตรวจ Customer -> Admin -> My Trip ด้วยบัญชี LINE จริงหลัง release

## Live acceptance ที่ยังค้าง

- [ ] Customer เลือกแพ็กเกจ -> จอง -> ยืนยันจ่ายจำลอง -> Admin เห็น -> เพิ่มและเปิด My Trip ใหม่ ผ่าน LINE จริง
- [ ] ตรวจรายการเดิมหลังปิด/เปิดแอปและคำขอซ้ำบน production

โค้ด deploy แล้วใน production commit `4ad0423`; ไม่ต้อง migrate 006 ซ้ำ
