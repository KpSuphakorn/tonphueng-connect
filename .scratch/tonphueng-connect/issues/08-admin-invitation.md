# 08: เพิ่ม Admin และผูก LINE ของผู้รับสิทธิ์

**What to build:** Admin ที่มีสิทธิ์เพิ่มบัญชีผู้ดูแลใหม่ ผู้รับเข้าสู่ระบบ ยืนยันรับสิทธิ์ และผูกตัวตน LINE ของตนก่อนใช้สิทธิ์ Admin ได้

**Blocked by:** 01: เข้าสู่ระบบและตรวจสิทธิ์แต่ละบทบาท.

**Status:** implementation-complete-awaiting-live-acceptance

**Spec:** [Approved spec](../spec.md)

**Coverage:** User Stories 38-39; ส่วนเพิ่ม Admin ของ AC04 และขอบเขตสิทธิ์ของ AC14

## Acceptance criteria

- [x] Admin ที่ผ่านอีเมล/รหัสผ่านและ LINE ตามกติกาแล้วเท่านั้นที่เพิ่มบัญชี Admin ใหม่ด้วยอีเมล/รหัสผ่านเริ่มต้นตามสเปกได้
- [x] ผู้รับเข้าสู่ระบบและยืนยันรับสิทธิ์ พร้อมผูก LINE ที่ server ตรวจยืนยันแล้วกับบัญชีของตน
- [x] บัญชีที่ยังไม่ยืนยันหรือยังไม่ผูก LINE ใช้สิทธิ์ Admin ไม่ได้ แม้เรียกการทำงานของ Admin โดยตรง
- [x] หลังผูกแล้ว การเข้า Admin ต้องตรวจบัญชีและตัวตน LINE ให้ตรงตามกติกาเดิม ไม่เก็บ token ที่หมดอายุแทนตัวตนถาวร
- [x] Customer/Staff ไม่สามารถเพิ่ม Admin หรือกำหนดสิทธิ์ให้ตนเอง และไม่มีการเผยรหัสผ่านหรือ service credentials ในผลตอบกลับ/รายงาน
- [x] ผ่านการทดสอบ Admin เดิมเพิ่ม -> ผู้รับยืนยัน/ผูก -> เข้าใช้ รวมสิทธิ์ไม่พอ LINE ไม่ตรง และขั้นตอนยังไม่ครบ

## External prerequisites and evidence

- Live acceptance ใช้บัญชีทดสอบที่ผู้ใช้ควบคุมและอนุญาตให้สร้าง ไม่เพิ่มบัญชีจริงในระบบภายนอกโดยอาศัยเพียงการอนุมัติ tickets
- Local implementation complete with user-approved decisions (one email may hold Staff and Admin rows; explicit `acceptAdminRole` before LINE binding; existing Auth users keep their password). Migration `202610230009_multi_role_accounts.sql` was applied by the owner in the SQL Editor inside one transaction on 2026-10-23 before release. Independent authorization review: PASS WITH NOTES (low: concurrent double-submit of a new-email Staff registration can end in an uncertain 503 without affecting pre-existing data; accepted for the prototype). Local PGlite, HTTP-double and browser evidence is in the [Ticket 08 test report](../../../agent-runs/08-admin-invitation/test-report.md); live acceptance with user-controlled test accounts remains pending.
