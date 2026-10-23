# ฟีเจอร์ที่พัฒนาแล้ว

เอกสารอ้างอิง implementation ณ 23 ตุลาคม 2569 สำหรับผู้ดูแลและ agent ที่รับงานต่อ ข้อกำหนดอยู่ใน [spec](../.scratch/tonphueng-connect/spec.md) วิธีตั้งค่าอยู่ใน [setup](setup.md) และสถานะตรวจรับอยู่ใน ticket แต่ละใบ

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
| หน้าลูกค้า | `/services` ค้นหาและบันทึกสถานที่ได้; `/my-trip` แสดงรายการที่บันทึกเอง; `/my-order` ยังเป็นสถานะว่าง |

จุดเข้า: `/login`, `POST /api/auth/line`, `POST /api/auth/password`, `POST /api/auth/logout` และพื้นที่ `/staff`, `/admin`

โค้ดหลัก: [`auth.ts`](../src/lib/auth.ts), [`line.ts`](../src/lib/line.ts), [`Supabase clients`](../src/lib/supabase.ts), [`login form`](../src/app/login/login-form.tsx) และ [`auth routes`](../src/app/api/auth/)

ข้อมูล: `app_accounts` เก็บบทบาท/สถานะ/ตัวตน; `app_sessions` เก็บ session ที่เพิกถอนได้ ตาม [migration 001](../supabase/migrations/202610220001_identity.sql) ซึ่งใช้กับโครงการจริงแล้วผ่าน SQL Editor ไม่ได้บันทึก CLI migration history

สถานะ: production Vercel/LIFF และ callback fix deploy แล้ว; เจ้าของยืนยัน Customer, Admin binding และ approved Staff login สำเร็จ ยังรอ reopen/logout และ mismatched LINE บนเครื่องจริง ดู [ticket 01](../.scratch/tonphueng-connect/issues/01-role-login.md) และ [ผลทดสอบ](../agent-runs/01-role-login/test-report.md)

## 02 — สมัครผู้ประกอบการและอนุมัติ

| หน้า/endpoint | การทำงานที่มีแล้ว |
| --- | --- |
| `/staff/register`, `POST /api/staff/register` | สมัครด้วยข้อมูลกิจการ พิกัด หมวด โทรศัพท์ รูป อีเมล/รหัสผ่าน; ฟอร์มแสดง `* จำเป็นต้องกรอก` สำหรับทุกช่องที่ต้องกรอก; สร้าง Staff สถานะ `pending` และ Service ของบัญชีนั้น |
| `/admin` | Admin ที่มีสิทธิ์เห็นข้อมูลใบสมัคร อีเมลจาก Auth และรูปส่วนตัว; query ระบุ foreign key `services_account_id_fkey` เพื่อ join Service ให้ชัดเจน |
| `POST /api/admin/staff/[accountId]/approve` | ตรวจ Admin บน server และเปลี่ยน Staff จาก `pending` เป็น `active` ผ่าน SQL function; ต้องมี Service แล้ว |
| `/staff`, `POST /api/staff/profile` | Staff ที่อนุมัติแล้วเปิด/แก้ข้อมูลกิจการของตนได้; เจ้าของข้อมูลอ้างจาก session ฝั่ง server |

หมวด: สินค้าชุมชน ที่พัก ร้านอาหาร การท่องเที่ยว/เส้นทางเดินป่า และอื่น ๆ พร้อมข้อความระบุ

รูปสมัครต้องมี 1–19 รูป JPG/PNG/WebP ที่ server อ่านได้ ขนาดจริงไม่เกิน 5 MiB ต่อไฟล์ รวมไม่เกิน 25 MiB; เบราว์เซอร์อัปโหลด binary ไป private staging bucket ด้วย signed URL ที่จำกัดต่อ path ส่วน Vercel รับเฉพาะ metadata ขนาดเล็กและ session token เซิร์ฟเวอร์อ่าน/ตรวจรูปจริงแล้วปรับเป็น WebP ลง private canonical bucket การแก้โปรไฟล์ที่ไม่ส่งรูปใหม่เก็บรูปเดิมไว้; final photo paths จะถูกแทนที่หลัง PATCH สำเร็จเท่านั้น

โค้ดหลัก: [`staff.ts`](../src/lib/staff.ts), [`Staff pages`](../src/app/staff/), [`Admin pages`](../src/app/admin/) และ [`Staff APIs`](../src/app/api/staff/)

ข้อมูล: Auth เก็บอีเมล/รหัสผ่าน; `services.account_id` ผูกกิจการกับ `app_accounts` แบบหนึ่งต่อหนึ่ง สถานะอนุมัติอยู่ใน `app_accounts` ชุดเดียว [migration 002](../supabase/migrations/202610220002_staff_approval.sql) กำหนดตาราง `services`, private bucket `staff-business-photos` และ `approve_staff_account`; [migration 004](../supabase/migrations/202610230004_staff_photo_uploads.sql) เพิ่ม private staging bucket, hashed capability sessions และ atomic one-use claim โดย service role เท่านั้น

เมื่อยืนยันผลการเขียนไม่ได้ ระบบคืน `verify_required` และรักษาบัญชี/รูปที่อาจบันทึกแล้ว เมื่อ cleanup ก่อนเขียนกิจการล้มเหลว ระบบคืน `cleanup_required` พร้อมเลขอ้างอิง การตรวจสถานะและกู้คืนด้วยผู้ดูแลอยู่ใน [setup](setup.md)

สถานะ: migration 002 และ 004 ใช้กับโครงการจริงแล้ว; ตรวจ private bucket, RLS/grants และ PostgreSQL claim/owner/flow/expiry/quota โดย rollback ข้อมูลทดสอบแล้ว เจ้าของยืนยันสมัคร/อนุมัติ/Staff login บนระบบจริงสำเร็จ การตรวจรูปและแก้โปรไฟล์ผ่าน local HTTP doubles และ browser flow; ยังรอแก้โปรไฟล์/เปลี่ยนรูปแล้วเปิดใหม่บนมือถือจริง. Upload preparation is rate-limited to 25 anonymous registration sessions per two hours globally and 5 per Staff account per two hours; expired staging is cleaned in bounded batches only when a later upload is prepared. See [ticket 02](../.scratch/tonphueng-connect/issues/02-staff-approval.md), [setup and recovery guidance](setup.md), and [validation report](../agent-runs/02-staff-approval/test-report.md).

## 03 — ค้นหาบริการและ Service List API

`/services` กรองหมวด เลื่อนโหลดต่อเนื่อง และเรียงระยะเส้นตรงเมื่ออนุญาต GPS; รายละเอียดมีรูปสไลด์ คำอธิบาย และเปิด Google Maps ได้ Customer บันทึก/ลบสถานที่ส่วนตัวใน My Trip โดยไม่สร้าง Booking แสดงเฉพาะกิจการของ Staff ที่ active เท่านั้น

`GET /api/services` เป็น API สาธารณะสำหรับ storypage: หมวดและตัวอย่างคำขออยู่ใน [setup](setup.md#public-api-for-storypage) ส่ง `{ services, hasMore, limit }` ครั้งละ 12 รายการ รองรับ offset และพิกัด GPS รูปเป็น signed URL อายุหนึ่งชั่วโมง หมวด `community_product` คือข้อมูลกิจการสินค้าชุมชน ไม่ใช่ Product รายชิ้นของ Ticket 06

รอบ local นี้เพิ่ม CORS `Access-Control-Allow-Origin: *` เฉพาะ GET/OPTIONS ของ `/api/services` และ `/api/packages` รวม error responses ไม่ใช้ credentials และไม่เปลี่ยนสิทธิ์ API ส่วนตัว ต้อง release ก่อน storypage จะเรียกข้ามเว็บได้ GPS sort ปัจจุบันอ่านรายการที่กรองก่อนเรียง/แบ่งหน้า หากข้อมูลโตมากค่อยย้ายการเรียงเข้า PostgreSQL

Migration 003 ใช้กับ Supabase แล้ว; production GET ตอบ 200 ส่วน Staff edit -> Customer -> My Trip ผ่าน LINE จริงยังรอตรวจ ดู [Ticket 03](../.scratch/tonphueng-connect/issues/03-service-discovery.md) และ [ผลทดสอบ](../agent-runs/03-service-discovery/test-report.md)

## 04 — จัดแพ็กเกจและเลือกบริการ

Admin จัดสามหมวด Package, Sub Package และ slot ตามชนิด/จำนวนบริการ Customer เลือกบริการที่ตรงเงื่อนไขและบันทึก/เปิดตัวเลือกเดิมได้ Server ตรวจ revision/สิทธิ์/ตัวเลือกและราคา ราคาต่อคนเดโมที่ Admin กำหนดเก็บเป็น integer satang การเลือกอย่างเดียวยังไม่สร้าง Booking

ช่องบังคับของ Package/Sub Package/slot แสดง `*` และคำอธิบาย ช่องราคา ระยะเวลา และจำนวนเก็บข้อความระหว่างพิมพ์เพื่อให้ลบจนว่างได้ตามปกติ ตรวจค่าตอนบันทึก โดยไม่เปลี่ยนกฎราคา/จำนวนเดิม

Migration 005 ใช้กับ Supabase แล้ว; SQL ราคา/ตัวเลือก/revision probes ผ่านและ rollback ข้อมูลทดสอบ ยังรอ Admin จัดแพ็กเกจ -> Customer เลือกจริงบน LINE ดู [Ticket 04](../.scratch/tonphueng-connect/issues/04-package-selection.md) และ [ผลทดสอบ](../agent-runs/04-package-selection/test-report.md)

## 05 — Package Booking และ My Trip

Customer เลือกวันเริ่มและผู้เข้าร่วมได้หลังเลือกบริการครบ ระบบตรวจ revision/บริการ/ราคาใน PostgreSQL แล้วคำนวณยอดจากราคาต่อคนที่ Admin ตั้งไว้; ระยะเวลาแพ็กเกจ 1–30 วันกำหนดวันสิ้นสุดบน server และข้อมูลเดิมที่ไม่มีระยะเวลาใช้ 1 วัน Booking เก็บ snapshot ของแพ็กเกจและบริการ พร้อมวันเริ่ม/สิ้นสุดและยอดเพื่อให้รายการเดิมอ่านได้หลังแก้ Catalogue

การชำระเงินเป็นการจำลองเท่านั้น: หน้า Booking แสดงตัวอย่าง QR ที่ใช้จ่ายเงินจริงไม่ได้และต้องให้ Customer ยืนยันแยกต่างหาก ไม่มีผู้ให้บริการชำระเงินหรือการตรวจยอดธนาคาร การสร้างรายการใช้ request UUID เพื่อ replay ซ้ำได้โดยไม่สร้าง Booking ซ้ำ การยืนยันและเพิ่มสถานที่เข้า My Trip ทำแบบ idempotent; สถานที่จาก Booking อยู่คนละตารางกับที่ Customer บันทึกเอง

จุดเข้า: `/packages/[subPackageId]`, `/bookings/[bookingId]`, `/my-trip`, `/admin/bookings`, `POST /api/bookings`, `POST /api/bookings/[bookingId]/confirm`, `POST /api/bookings/[bookingId]/my-trip` โค้ดหลัก: [`packages.ts`](../src/lib/packages.ts) และ migration [006](../supabase/migrations/202610230006_package_bookings.sql)

สถานะ: local checks pass; migration 006 was applied to the connected Supabase project on 2026-10-23. Real SQL probes passed with all probe writes rolled back, and PostgREST table/RPC access was verified. Hosted Customer/LINE booking acceptance remains pending. See [Ticket 05](../.scratch/tonphueng-connect/issues/05-package-booking.md) and its [test report](../agent-runs/05-package-booking/test-report.md).

## UI และสถานะงาน

รอบ local นี้ปรับ UI ทั้งแอปผ่าน shared styles: พื้นขาว เส้นแบ่ง ลดการ์ดซ้อน/เงา/ของตกแต่ง คงสีเขียวของผึ้งพาเดิน ช่องกรอกเหมาะกับมือถือและมี focus ชัด หน้าแรกเชื่อมงานที่ทำได้จริง พร้อมระบุสินค้า/Order ที่ยังไม่เปิด Staff บันทึกโปรไฟล์แล้วเห็นผลสำเร็จต่อเนื่องพร้อมข้อมูลที่ refresh

Tickets 01–05 พัฒนาและทดสอบแล้ว (ดู checkboxes ใน ticket เดิม); live checks ที่ยังค้างแยกไว้แต่ละใบ รอบ UI/CORS/ช่องตัวเลขผ่าน typecheck, unit 42/42, browser 13/13, targeted Staff flow หลังแก้ล้างไฟล์ 1/1 และ production build ตรวจภาพมือถือ/เดสก์ท็อปแล้ว Impeccable detector ไม่พบรายการเตือน งานรอบนี้ยังไม่ commit/push/deploy

## งานที่ยังไม่พัฒนา

งานหลักที่เหลือคือ Tickets 06–08: สินค้า/Order และเชิญ Admin ส่วน Ticket 09 (AI chat) และ 10 (Feedback) เป็น optional ทำเมื่อมีเวลา Tickets 04–05 ใช้ migrations 005–006 กับ Supabase จริงแล้ว และรอ hosted workflow acceptance ตามรายงาน รายละเอียดอยู่ใน [tickets เดิม](../.scratch/tonphueng-connect/issues/)


ข้อมูลธุรกิจที่ยังขาดใช้ข้อมูลเดโมที่ระบุชัดเจนได้ ระบบบันทึกและตรวจสิทธิ์ยังทำงานจริง การตั้งค่า/การอนุญาตบริการภายนอกยังค้างตาม [ตารางของ spec](../.scratch/tonphueng-connect/spec.md#ข้อมูลและการตั้งค่าที่ยังรอ)
