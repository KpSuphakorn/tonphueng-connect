# 03: Staff ลงบริการ -> Customer ค้นหาและบันทึกสถานที่

**What to build:** Staff จัดการบริการของตน แล้ว Customer ค้นหา ดูรายละเอียด เปิดหมุด และบันทึกสถานที่เข้า My Trip ได้

**Blocked by:** 02: สมัคร Staff -> Admin อนุมัติ -> เข้าใช้งาน.

**Status:** implementation-complete-awaiting-live-acceptance

**Spec:** [Approved spec](../spec.md)

**Coverage:** User Stories 13-19, ส่วนบริการของ 30, 33; ส่วนบริการของ AC05, AC06, AC07, ส่วนบันทึกเองของ AC10 และส่วนบริการ/My Trip ของ AC14-AC15

## Acceptance criteria

- [ ] Staff จัดการข้อมูลบริการของตนที่ใช้แสดงชื่อ รายละเอียดเต็ม รูปภาพ หมวด และพิกัดได้ Customer อ่านข้อมูลที่บันทึกจริงได้
- [ ] รายการเลื่อนโหลดต่อเนื่องโดยไม่มีเลขหน้าและไม่มีดาว Rating กรองด้วยหมวดเดียวกับประเภทกิจการได้
- [ ] Service List มี `GET /api/services?category=...` รองรับ `community_product`, `accommodation`, `restaurant`, `tourism_trail`, `other`; ไม่ระบุหมวดแสดงรวม หมวดไม่ถูกต้องตอบ 400 และไม่เปิดเผยข้อมูล Auth/ใบสมัครค้างหรือบริการของบัญชีที่ยังไม่อนุมัติ
- [ ] รายละเอียดบริการแสดง Image Slide และคำอธิบายเต็ม เปิด Google Maps ด้วยพิกัดของบริการที่เลือกได้
- [ ] เมื่ออนุญาต GPS สามารถเรียงระยะจาก Customer ได้โดยอธิบายตรงกับวิธีคำนวณจริง ไม่ใช้ระยะเส้นตรงอ้างว่าเป็นระยะเดินทาง
- [ ] เมื่อปฏิเสธ GPS หรือหา GPS ไม่ได้ ยังเปิดและกรองบริการได้โดยไม่สร้างตำแหน่งสมมติ
- [ ] Customer บันทึกสถานที่เข้า My Trip และเปิดดูหลังเข้าใหม่ได้ การบันทึกเองไม่สร้าง Booking หรือแสดงว่าได้จองแล้ว
- [ ] Customer เห็นเฉพาะ My Trip ของตน; Staff เปลี่ยนบริการของผู้ประกอบการอื่นไม่ได้แม้แก้ตัวระบุในคำขอ
- [ ] ผ่านการทดสอบ Staff บันทึก -> Customer ค้นหา/ดู/บันทึก รวม filter, GPS อนุญาต/ไม่อนุญาต และการตรวจสิทธิ์

## External prerequisites and evidence

- ใช้ข้อมูลกิจการ รูป คำอธิบาย และพิกัดเดโมตามนโยบาย prototype ใน spec ได้ โดยระบุว่าเป็นตัวอย่าง ไม่อ้างการรับรองบริการหรือสิทธิใช้เส้นทางจริง
- เก็บหลักฐานรายการที่เปลี่ยนตามข้อมูล Staff และ My Trip ที่อ่านกลับมาได้

## Comments

- 2026-10-23: Local implementation and checks completed: 25 Vitest tests, 4 Playwright tests, typecheck, production build, and diff check passed. Browser coverage extends the Staff-to-Customer flow through details, GPS denial/allowance, delayed filter changes, saving, and My Trip reload. Migration 003 remains local; real Supabase/LINE and hosted acceptance are pending. The acceptance criteria above are unchanged and await live acceptance. See [validation evidence](../../../agent-runs/03-service-discovery/test-report.md). No Ticket 03 commit, push, deployment, or external seed was made.
- 2026-10-23: Fresh independent review passed Standards and Spec without blocking findings; no source corrections were needed. Local approval does not replace real Supabase/LINE/hosted acceptance, and migration 003 remains unapplied.

- 2026-10-23: User-authorized migration 003 applied manually in a transaction to the intended Supabase project. Verified the description constraint, saved-place composite primary key, foreign keys, RLS and denied browser-role access. No demo data was seeded. Live Supabase/LINE/hosted application acceptance remains pending; status stays `implementation-complete-awaiting-live-acceptance`.
