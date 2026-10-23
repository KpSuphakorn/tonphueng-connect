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

สถานะ: production Vercel deploy และ LIFF endpoint/scope ได้รับการตรวจยืนยันแล้ว; การเข้า LINE จริง การผูก Admin และ session ข้ามการเปิดแอปยังรอตรวจรับ การแก้ callback ต่อเนื่องจาก Chrome ภายนอกนี้ยังรอ deploy และทดสอบบนมือถือ ดู [ticket 01](../.scratch/tonphueng-connect/issues/01-role-login.md) และ [ผลทดสอบ](../agent-runs/01-role-login/test-report.md)

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

สถานะ: migration 002 และ 004 ใช้กับโครงการจริงแล้ว; ตรวจ private bucket, RLS/grants และ PostgreSQL claim/owner/flow/expiry/quota โดย rollback ข้อมูลทดสอบแล้ว การตรวจรูป/การสมัคร/การแก้โปรไฟล์ผ่าน local HTTP doubles และ browser flow; independent review ผ่าน Standards/Spec แต่ real Auth/Storage, CORS, hosted Vercel และ LINE acceptance ยัง pending. Upload preparation is rate-limited to 25 anonymous registration sessions per two hours globally and 5 per Staff account per two hours; expired staging is cleaned in bounded batches only when a later upload is prepared. See [ticket 02](../.scratch/tonphueng-connect/issues/02-staff-approval.md), [setup and recovery guidance](setup.md), and [validation report](../agent-runs/02-staff-approval/test-report.md).

## งานที่ยังไม่พัฒนา

งานหลักที่เหลือคือ Tickets 05–08: Booking, สินค้า/Order และเชิญ Admin ส่วน Ticket 09 (AI chat) และ 10 (Feedback) เป็น optional ทำเมื่อมีเวลา Ticket 04 ใช้ migration 005 กับ Supabase จริงแล้ว และรอ hosted workflow acceptance ตามรายงาน รายละเอียดอยู่ใน [tickets เดิม](../.scratch/tonphueng-connect/issues/)

Ticket 04 is implemented locally: Admin can edit the three Package categories and typed Sub Package slots; Customers can browse, choose eligible active Staff services, and save/reload a selection. The demo price is an Admin-entered per-person amount in integer satang; this ticket records a selection only and does not create a Booking or take payment. The package catalogue and selection use migration 005, applied to the connected project on 2026-10-23. PostgreSQL RLS/grants and RPC probes passed with probe data rolled back; application HTTP/browser checks use loopback doubles, and live Admin/Customer workflow acceptance remains pending. See the [Ticket 04 report](../agent-runs/04-package-selection/test-report.md).

Ticket 03 เพิ่ม `GET /api/services?category=...` พร้อม filter, offset pagination, optional GPS distance ordering, detail/gallery, and customer-owned My Trip saves. Omitting `category` shows all categories; an invalid supplied value returns 400. List and detail expose only services owned by active Staff. GPS ordering loads the filtered catalogue before slicing so each page follows one global distance order; move this sort into Postgres if the catalogue grows substantially. Migration 003 adds the Service description and private saved-service relation; it was applied to the connected Supabase project on 2026-10-23 with schema and access checks verified. Live application acceptance remains pending. Local checks and remaining acceptance are recorded in the [Ticket 03 report](../agent-runs/03-service-discovery/test-report.md).

ข้อมูลธุรกิจที่ยังขาดใช้ข้อมูลเดโมที่ระบุชัดเจนได้ ระบบบันทึกและตรวจสิทธิ์ยังทำงานจริง การตั้งค่า/การอนุญาตบริการภายนอกยังค้างตาม [ตารางของ spec](../.scratch/tonphueng-connect/spec.md#ข้อมูลและการตั้งค่าที่ยังรอ)
