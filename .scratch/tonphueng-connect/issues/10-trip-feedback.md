# 10: ขอและรับ feedback หลังทริป

**What to build:** ระบบส่งแชทขอ Feedback ประมาณ 3 วันหลังจบทริป เก็บคำตอบของ Customer กับบริบทที่ถูกต้อง และป้องกันคำขอเดิมถูกส่งซ้ำ

**Blocked by:** 05: จอง -> จ่ายจำลอง -> Admin เห็น -> เข้า My Trip.

**Status:** implementation-complete-awaiting-live-acceptance

**Priority:** optional — ทำเมื่อมีเวลาหลังงานหลัก 01–08 ไม่เป็นเงื่อนไขส่ง prototype และไม่ต้องรอ Ticket 09; เกณฑ์ด้านล่างใช้เมื่อเลือกทำ

**Spec:** [Approved spec](../spec.md)

**Coverage:** User Stories 45-47; ส่วน webhook ของ AC17, AC18, AC19 และส่วนตั้งเวลา/ส่งข้อความของ AC20

## Acceptance criteria

- [x] ใช้วันจบทริปที่มาจาก Booking/ระยะเวลาที่ทีมยืนยัน ไม่ใช้วันจองหรือวันจ่ายเงินแทน และพิจารณาเวลาตาม Asia/Bangkok (PGlite before/after probe; ดู [report](../../../agent-runs/10-trip-feedback/test-report.md))
- [ ] งานตั้งเวลาทำงานได้แม้ Customer ปิดเว็บ ไม่ส่งก่อนถึงกำหนด และส่งคำขอประมาณ 3 วันหลังจบทริปผ่าน LINE Messaging API
- [x] เฉพาะการเรียกงานตั้งเวลาที่มีสิทธิ์จึงส่งข้อความได้ ไม่เปิดช่องทางสาธารณะให้สั่งส่งข้อความโดยไม่มีการตรวจ (local bearer-auth test)
- [x] บันทึกผลและตัวอ้างอิงการส่งอย่างเพียงพอให้รันซ้ำแล้วไม่สร้างคำขอเดิมซ้ำโดยไม่ตั้งใจ; การส่งล้มเหลวหรือผลไม่แน่ชัดไม่ถูกบันทึกเท็จว่าส่งถึงแล้ว (PGlite idempotency and controlled LINE HTTP test; no live delivery claim)
- [x] รับคำตอบ Feedback ผ่าน webhook ที่ตรวจ signature และจัดการ event ซ้ำได้ เก็บคำตอบกับ Customer/Booking ที่ระบุได้อย่างถูกต้อง (webhook HTTP and PGlite context tests)
- [x] การรับคำตอบ Feedback ไม่ต้องอาศัยโมเดล AI หรือทำให้ ticket นี้ต้องรอ ticket 09; หากมีแชทอยู่แล้วต้องทำงานร่วมกันได้โดยไม่รับข้อความเดิมผิดบริบท (tested with Chat disabled)
- [ ] ไม่เพิ่มดาว Rating แบบสอบถามหลายส่วน หรือ dashboard วิเคราะห์นอกสเปก
- [ ] ผ่านการทดสอบก่อน/หลังถึงกำหนด คำขอรันซ้ำ การเรียกไม่มีสิทธิ์ ส่งล้มเหลว webhook ไม่ถูกต้อง และคำตอบที่ผูกบริบทถูกต้อง โดยควบคุมเวลาทดสอบได้
- [ ] มีหลักฐานส่งและรับจริงกับบัญชีทดสอบหลังได้รับอนุญาต พร้อมสอนเจ้าของตั้งค่าที่จำเป็น โดยไม่ต้องรอเวลา 3 วันจริงในการสาธิตเงื่อนไข

## External prerequisites and evidence

- ใช้ Booking `end_date + 3` ตาม Asia/Bangkok; `vercel.json` configures a daily Hobby cron, migration 010 was applied with owner authorization on 2026-10-23 and metadata checks passed; owner secrets and live acceptance remain required before enabling it.
- การส่งข้อความจริงหรือ deploy ไม่ได้รับอนุญาตโดยอัตโนมัติจากการอนุมัติ ticket นี้
- การตรวจ type, regression และ review ของงานหลัก 01–08 ไม่ต้องรอ ticket นี้; หากทำ optional ต้องทดสอบส่วนที่เพิ่มและเส้นทางที่เกี่ยวข้องก่อนอ้างว่าทำงานจริง

## Implementation evidence

Implementation is local and default-off. See the [Ticket 10 report](../../../agent-runs/10-trip-feedback/test-report.md) for SQL timing/idempotency/ACL probes, local auth/HTTP tests, and the remaining live acceptance requirement. An accepted LINE push request is not proof of delivery.
