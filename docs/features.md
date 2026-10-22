# ฟีเจอร์ที่พัฒนาแล้ว

เอกสารอ้างอิง implementation ณ 22 ตุลาคม 2569 สำหรับผู้ดูแลและ agent ที่รับงานต่อ ข้อกำหนดอยู่ใน [spec](../.scratch/tonphueng-connect/spec.md) วิธีตั้งค่าอยู่ใน [setup](setup.md) และสถานะตรวจรับอยู่ใน ticket แต่ละใบ

## โครงสร้างปัจจุบัน

Next.js และ TypeScript แอปเดียว ใช้ Supabase Auth, PostgreSQL และ Storage; LINE LIFF ส่ง ID token ให้ server ตรวจยืนยันกับ LINE

| ตำแหน่ง | หน้าที่ |
| --- | --- |
| `src/app/**/page.tsx` และ form components | หน้าเว็บภาษาไทย การรับข้อมูล และการแสดงผลตามบัญชี |
| `src/app/api/**/route.ts` | HTTP endpoints ตรวจคำขอ ตัวตน/สิทธิ์ และดำเนินการฝั่ง server |
| [`src/lib/`](../src/lib/) | กฎและฟังก์ชันที่ใช้ร่วมกัน: session, LINE verification, Staff profile/รูป และ Supabase clients |
| [`supabase/migrations/`](../supabase/migrations/) | schema สิทธิ์ฐานข้อมูล bucket และ SQL functions |
| [`scripts/bootstrap-admin.ts`](../scripts/bootstrap-admin.ts) | สร้าง Admin เริ่มต้นผ่านขั้นตอนของเจ้าของโครงการ |
| [`tests/`](../tests/) | ทดสอบพฤติกรรมผ่าน HTTP และ browser โดยแยกบริการจำลองจากระบบจริง |

## 01 — เข้าสู่ระบบและตรวจสิทธิ์

| ผู้ใช้/พฤติกรรม | การทำงานที่มีแล้ว |
| --- | --- |
| Customer | LIFF ID token ถูกตรวจบน server ก่อนสร้าง/ค้นบัญชี LINE และออก application session |
| Staff | อีเมล/รหัสผ่านผ่าน Supabase Auth; สถานะ `pending` หรือ `disabled` ไม่ได้รับสิทธิ์ Staff |
| Admin | อีเมล/รหัสผ่านร่วมกับ LINE ที่ตรวจแล้ว; Admin เริ่มต้นผูก LINE ครั้งแรกได้ครั้งเดียว และครั้งต่อไปต้องตรงบัญชี |
| Session/logout | cookie แบบ HttpOnly; ฐานข้อมูลเก็บ hash ของ token อายุ 14 วัน; logout เพิกถอน session |
| หน้าลูกค้า | `/`, `/my-trip`, `/my-order` มีโครงหน้าและสถานะว่าง ส่วนรายการสินค้า/ทริปยังไม่พัฒนา |

จุดเข้า: `/login`, `POST /api/auth/line`, `POST /api/auth/password`, `POST /api/auth/logout` และพื้นที่ `/staff`, `/admin`

โค้ดหลัก: [`auth.ts`](../src/lib/auth.ts), [`line.ts`](../src/lib/line.ts), [`Supabase clients`](../src/lib/supabase.ts), [`login form`](../src/app/login/login-form.tsx) และ [`auth routes`](../src/app/api/auth/)

ข้อมูล: `app_accounts` เก็บบทบาท/สถานะ/ตัวตน; `app_sessions` เก็บ session ที่เพิกถอนได้ ตาม [migration 001](../supabase/migrations/202610220001_identity.sql) ซึ่งใช้กับโครงการจริงแล้วผ่าน SQL Editor ไม่ได้บันทึก CLI migration history

สถานะ: implementation และ local review ผ่าน; การเข้า LINE จริง การผูก Admin และ session ข้ามการเปิดแอปยังรอตรวจรับ ดู [ticket 01](../.scratch/tonphueng-connect/issues/01-role-login.md) และ [ผลทดสอบ](../agent-runs/01-role-login/test-report.md)

## 02 — สมัครผู้ประกอบการและอนุมัติ

| หน้า/endpoint | การทำงานที่มีแล้ว |
| --- | --- |
| `/staff/register`, `POST /api/staff/register` | สมัครด้วยข้อมูลกิจการ พิกัด หมวด โทรศัพท์ รูป อีเมล/รหัสผ่าน; สร้าง Staff สถานะ `pending` และ Service ของบัญชีนั้น |
| `/admin` | Admin ที่มีสิทธิ์เห็นข้อมูลใบสมัคร อีเมลจาก Auth และรูปส่วนตัว |
| `POST /api/admin/staff/[accountId]/approve` | ตรวจ Admin บน server และเปลี่ยน Staff จาก `pending` เป็น `active` ผ่าน SQL function; ต้องมี Service แล้ว |
| `/staff`, `POST /api/staff/profile` | Staff ที่อนุมัติแล้วเปิด/แก้ข้อมูลกิจการของตนได้; เจ้าของข้อมูลอ้างจาก session ฝั่ง server |

หมวด: สินค้าชุมชน ที่พัก ร้านอาหาร การท่องเที่ยว/เส้นทางเดินป่า และอื่น ๆ พร้อมข้อความระบุ

รูปสมัครต้องมี 1–19 รูป JPG/PNG/WebP ที่ server อ่านได้ ขนาดไม่เกิน 5 MiB ต่อไฟล์ รวมไม่เกิน 25 MiB; multipart จำกัดข้อมูลที่รับจริง 27 MiB รูปถูกปรับเป็น WebP เก็บใน private bucket และแสดงผ่าน signed URL การแก้โปรไฟล์ที่ไม่ส่งรูปใหม่เก็บรูปเดิมไว้

โค้ดหลัก: [`staff.ts`](../src/lib/staff.ts), [`Staff pages`](../src/app/staff/), [`Admin pages`](../src/app/admin/) และ [`Staff APIs`](../src/app/api/staff/)

ข้อมูล: Auth เก็บอีเมล/รหัสผ่าน; `services.account_id` ผูกกิจการกับ `app_accounts` แบบหนึ่งต่อหนึ่ง สถานะอนุมัติอยู่ใน `app_accounts` ชุดเดียว [migration 002](../supabase/migrations/202610220002_staff_approval.sql) กำหนดตาราง `services`, private bucket `staff-business-photos` และ `approve_staff_account`

เมื่อยืนยันผลการเขียนไม่ได้ ระบบคืน `verify_required` และรักษาบัญชี/รูปที่อาจบันทึกแล้ว เมื่อ cleanup ก่อนเขียนกิจการล้มเหลว ระบบคืน `cleanup_required` พร้อมเลขอ้างอิง การตรวจสถานะและกู้คืนด้วยผู้ดูแลอยู่ใน [setup](setup.md)

สถานะ: implementation และ local review ผ่าน; migration 002 ใช้กับโครงการจริงแล้ว แต่การทดสอบ Auth/Storage และขั้นสมัคร-อนุมัติด้วยข้อมูลจริงยังค้าง ดู [ticket 02](../.scratch/tonphueng-connect/issues/02-staff-approval.md) และ [ผลทดสอบ](../agent-runs/02-staff-approval/test-report.md)

## งานที่ยังไม่พัฒนา

งานหลักที่เหลือคือ Tickets 03–08: discovery/My Trip, แพ็กเกจ/Booking, สินค้า/Order และเชิญ Admin ส่วน Ticket 09 (AI chat) และ 10 (Feedback) เป็น optional ทำเมื่อมีเวลา รายละเอียดอยู่ใน [tickets เดิม](../.scratch/tonphueng-connect/issues/)

Service List ใน Ticket 03 วางแผน `GET /api/services?category=...` สำหรับกิจการ/สถานที่ตามหมวดในสเปก รวมร้านสินค้าชุมชน endpoint นี้ยังไม่ได้ implement และไม่มีการแก้เว็บเดิม

ข้อมูลธุรกิจที่ยังขาดใช้ข้อมูลเดโมที่ระบุชัดเจนได้ ระบบบันทึกและตรวจสิทธิ์ยังทำงานจริง การตั้งค่า/การอนุญาตบริการภายนอกยังค้างตาม [ตารางของ spec](../.scratch/tonphueng-connect/spec.md#ข้อมูลและการตั้งค่าที่ยังรอ)
