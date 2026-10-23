# 04: Admin จัดแพ็กเกจ -> Customer เลือก slot

**What to build:** Admin กำหนด Package, Sub Package ราคาและ slot แล้ว Customer ดูรายละเอียดและเลือกบริการตามตัวเลือกและจำนวนที่กำหนดได้

**Blocked by:** 03: Staff ลงบริการ -> Customer ค้นหาและบันทึกสถานที่.

**Status:** implementation-complete-awaiting-live-acceptance

**Spec:** [Approved spec](../spec.md)

**Coverage:** User Stories 5-7, 36; AC08 และส่วนแพ็กเกจของ AC14-AC15

## Acceptance criteria

- [x] Admin จัดการ Package/Sub Package ราคา ชนิดและจำนวน slot พร้อมบริการหรือสถานที่ที่เลือกได้ โดยข้อมูลบันทึกจริง
- [x] Customer เห็นการ์ดประเภทแพ็กเกจและ Sub Package พร้อมราคาตามข้อมูลที่ทีมยืนยัน และเปิดช่องทางติดต่อสำหรับแพ็กเกจเพิ่มเติมได้
- [x] Customer เลือกตัวเลือกในแต่ละ slot ตามชนิดและจำนวนที่ Admin กำหนด ไม่ลด requirement ให้เหลือแพ็กเกจตายตัว
- [x] Server ปฏิเสธตัวเลือกที่ไม่อยู่ในแพ็กเกจ ชนิดไม่ตรง หรือจำนวนไม่ตรงตามกติกา
- [x] ข้อมูลที่ Admin เปลี่ยนแสดงต่อ Customer ตามจริง และข้อมูลยังอยู่หลังโหลดหน้าใหม่
- [x] Customer/Staff ไม่มีสิทธิ์เปลี่ยนการตั้งค่าแพ็กเกจของ Admin โดยเรียกตรง
- [x] ผ่านการทดสอบ Admin จัดข้อมูล -> Customer เลือกสำเร็จและผิดเงื่อนไข พร้อมตรวจราคาตามสูตรที่ได้รับยืนยัน

รายการที่เช็กด้านบนหมายถึงพัฒนาและผ่าน automated/local checks ตามรายงาน ไม่ใช่การรับรองว่า live flow ทุกกรณีผ่านแล้ว

## Live acceptance ที่ทำแล้วและยังค้าง

- [x] Migration 005 ใช้กับ Supabase จริงแล้ว; ตรวจ RLS/grants และ RPC ราคา/ตัวเลือก/revision ด้วยข้อมูลทดสอบที่ rollback แล้ว
- [ ] Admin สร้าง Sub Package/slot จริง แล้ว Customer เลือกและเปิดรายการเดิมผ่าน LINE

## External prerequisites and evidence

- ใช้ Package/Sub Package/slot สูตรราคา ระยะเวลาทริป วันให้บริการ และช่องทางติดต่อเดโมตามนโยบาย prototype ใน spec ได้ ไม่ต้องรอข้อมูลธุรกิจจริงเพื่อส่งต้นแบบ
- เกณฑ์ที่กล่าวถึงข้อมูลหรือสูตรที่ยืนยันใน ticket นี้ใช้ชุดข้อมูลเดโมที่บันทึกและคำนวณจริงได้ โดยระบุว่าเป็นตัวอย่าง
- ไม่ใช้ราคา เส้นทาง หรือโปรแกรมใน archive/แบบจำลองการเงินเป็นข้อสรุปแทนทีม

- 2026-10-23: Local review condition resolved: restored choices are filtered against current options, and the browser flow verifies replacing a saved Service after Admin changes the catalog. Manager verified the correction; no additional blocking pricing/authorization/atomicity finding remains. Migration 005 and hosted acceptance remain pending owner authorization. See the existing test report.

- 2026-10-23: Owner authorized migration and release. Migration 005 applied after PostgreSQL-only variable/column qualification corrections; RLS/grants and actual RPC validation/CAS/price/upsert probes passed and were rolled back. No durable business data was seeded. Full hosted Admin/Customer workflow acceptance remains pending; details are in the existing report.

- 2026-10-23 (สถานะล่าสุด): โค้ด Tickets 01–05 อยู่บน production commit `4ad0423`; รายการ pending/uncommitted ในบันทึกก่อนหน้าเป็นประวัติ ไม่ใช่สถานะปัจจุบัน รอบปรับ UI/CORS และ numeric-input UX ยังเป็นงาน local รออนุญาต release
