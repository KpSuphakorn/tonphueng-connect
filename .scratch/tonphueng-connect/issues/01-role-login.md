# 01: เข้าสู่ระบบและตรวจสิทธิ์แต่ละบทบาท

**What to build:** Customer เปิดเว็บผ่าน LIFF และใช้เมนูหลักได้ Staff/Admin เข้าสู่พื้นที่ของตนด้วยวิธีตามสเปก พร้อมเตรียม Admin เริ่มต้นและสอนเจ้าของโครงการตั้งค่า LINE ที่จำเป็น

**Blocked by:** None (can start immediately).

**Status:** implementation-complete-awaiting-live-acceptance

**Evidence:** [Ticket 01 test and connection report](../../../agent-runs/01-role-login/test-report.md)

**Spec:** [Approved spec](../spec.md)

**Coverage:** User Stories 1-4, 29, 34, 47; AC01, ส่วนเข้าสู่ระบบของ AC04, ขอบเขตตัวตน/บทบาทของ AC14, ข้อมูลบัญชีคงอยู่ของ AC15 และส่วนตั้งค่าเข้าสู่ระบบของ AC20

## Acceptance criteria

- [x] มีหน้าเลือก Login Type; Customer ใช้ LINE โดยไม่กรอกแบบสมัครสมาชิก Staff ใช้อีเมล/รหัสผ่าน และ Admin ใช้อีเมล/รหัสผ่านร่วมกับ LINE ที่ตรวจและผูกกับบัญชี (live LINE ยังรอตั้งค่าและตรวจจริง)
- [x] Server ตรวจ LINE token ก่อนสร้างหรือใช้ตัวตน Customer; ข้อมูล profile หรือ role ที่ browser ส่งเองไม่สามารถใช้ข้ามการตรวจได้ (ทดสอบด้วย HTTP doubles)
- [x] Customer มี Main Page, My Trip, My Order และการ์ด Package/Product Order/บริการของเรา หน้าที่ยังไม่มีข้อมูลแสดงสถานะว่างตามจริง
- [x] มีขั้นตอนเตรียม Admin เริ่มต้นที่เจ้าของควบคุม ไม่มีช่องทางสาธารณะให้กำหนดตนเองเป็น Admin และไม่มีรหัสผ่านเริ่มต้นฝังในโค้ด
- [x] Staff ที่ยังไม่อนุมัติไม่มีสิทธิ์ Staff; บัญชี Staff ที่อนุมัติแล้วผ่านการทดสอบพฤติกรรมด้วย HTTP doubles โดย flow สมัคร/อนุมัติจริงอยู่ใน ticket 02
- [x] Server ตรวจบทบาทก่อนเข้าอ่านหรือใช้พื้นที่ Staff/Admin การแก้ role หรือ owner ในคำขอไม่ให้สิทธิ์เพิ่ม และไม่ส่ง secrets ให้ browser (ทดสอบด้วย HTTP doubles และ Playwright)
- [ ] ข้อมูลตัวตนและการผูกบัญชีบันทึกจริงและกลับมาใช้งานหลังปิดหน้าเว็บได้ ไม่ใช้ mock login ในผลิตภัณฑ์เพื่อทดแทน LINE จริง (ยังรอ live login/session checks)
- [x] มี setup guide สำหรับ OA, Provider เดียวกัน, LINE Login/LIFF และ HTTPS ที่ต้องเตรียม; การตั้งค่า live LIFF/HTTPS ยังรอดำเนินการ
- [x] ผ่าน typecheck และการทดสอบพฤติกรรมเข้าสู่ระบบสำเร็จ/ล้มเหลว LINE ไม่ตรงบัญชี token ไม่ถูกต้อง บทบาทไม่ตรง และบัญชี Staff ยังไม่อนุมัติ

## External prerequisites and evidence

- โครงการปัจจุบันมีตาราง identity ที่ apply ด้วย SQL Editor แล้ว และเชื่อมต่อแบบอ่านอย่างเดียวได้; ขั้นตอน migration สำหรับ project ใหม่อยู่ใน setup guide
- ยังไม่ปิด ticket ว่า live integration ผ่านจนตรวจ LINE LIFF, initial Admin binding, approved Staff, และ reopen/logout session ด้วยบัญชีจริง
- Live acceptance ใช้บัญชีและ LINE OA ที่เจ้าของควบคุม; test doubles ใน automated tests ไม่ใช่การอนุญาต mock ส่วนเข้าสู่ระบบในเดโม
- เก็บผลตรวจที่ทำจริงและข้อจำกัดที่ยังเหลือ โดยไม่ใส่ credentials ในรายงาน
