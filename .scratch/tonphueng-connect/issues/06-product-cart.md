# 06: Staff ลงสินค้า -> Customer จัดตะกร้า

**What to build:** Staff ลงสินค้า Customer เลือกร้านสินค้าชุมชน จัดตะกร้าร้านเดียว และเลือกวิธีรับสินค้าพร้อมเห็นยอดสินค้า/ค่าส่งแยกกัน

**Blocked by:** 02: สมัคร Staff -> Admin อนุมัติ -> เข้าใช้งาน.

**Status:** implementation-complete-awaiting-live-acceptance

**Spec:** [Approved spec](../spec.md)

**Coverage:** User Stories 20-23, ส่วนสินค้าของ 30, 33; ส่วนสินค้าของ AC05, AC11, AC12 และส่วนข้อมูลสินค้า/ตะกร้าของ AC14-AC15

## Acceptance criteria

- [x] Staff จัดการสินค้าของตนด้วยชื่อ รายละเอียด ราคา และรูปสินค้า 1 รูปได้ Customer เห็น Product List ที่อ่านจากข้อมูลจริง
- [x] Product Order ให้เลือกร้านเฉพาะประเภทสินค้าชุมชนและเพิ่มสินค้า/จำนวนจากร้านนั้นได้
- [x] หนึ่งตะกร้ามีสินค้าร้านเดียว การเพิ่มหรือส่งคำขอรวมร้านไม่ทำให้เกิดตะกร้าหรือยอดซื้อรวมหลายร้านโดยเงียบ ๆ
- [x] เลือกรับที่ร้านหรือจัดส่งได้ ถ้าจัดส่งเก็บที่อยู่ที่จำเป็นและแสดงค่าส่งคงที่แยกจากราคาสินค้า; รับที่ร้านค่าส่งเป็นศูนย์
- [x] Server ตรวจสินค้า จำนวนและราคา ไม่ยอมให้เปลี่ยนราคาสินค้าหรือค่าส่งผ่านค่าจาก browser
- [x] ข้อมูลสินค้าและตะกร้าของ Customer อ่านกลับได้ โดยไม่เปิดเผยตะกร้าของบัญชีอื่นหรือสิทธิ์แก้สินค้าของร้านอื่น
- [x] ผ่าน local tests Staff ลงสินค้า -> Customer เลือกร้าน/จำนวน/วิธีรับและเห็นยอด รวมหลายร้าน ข้อมูลไม่ครบ และการแก้ยอด

## External prerequisites and evidence

- ใช้ข้อมูลสินค้า รูป ราคา ค่าส่งคงที่และขอบเขตเดโมตามนโยบาย prototype ใน spec ได้ ต้องตั้งค่าเดโมให้ชัดเจน ไม่แปลงค่าส่งที่ยังไม่ตั้งเป็นศูนย์โดยเงียบ ๆ หรืออ้างว่าเป็นข้อตกลงจริง
- Ticket นี้ไม่ต้องรอการจองแพ็กเกจ; Order และจ่ายจำลองอยู่ใน ticket 07
- Migration `202610230007_products_cart.sql` was applied with owner authorization on 2026-10-23; RLS/grants, rollback-only real SQL probes and PostgREST access were verified. Local PGlite, HTTP-double and browser evidence is documented in [Ticket 06 test report](../../../agent-runs/06-product-cart/test-report.md); concurrent transaction and full hosted Customer/LINE acceptance remain pending.

- Focused independent authorization/money/SQL review passed with one Staff archive-list correction; Manager verified the active-only filter and passing archive/reload browser regression. Live migration is applied; full hosted acceptance remains pending.

- No Ticket 07 work was started. Remaining live acceptance: owner creates a Product with a real photo, Customer saves/reopens pickup and delivery carts from LINE, and concurrent-request checks.
