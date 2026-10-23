# 09: แชท AI ถามตอบและแนะนำจากข้อมูลจริง

**What to build:** Customer พิมพ์สนทนาอิสระใน LINE OA ผู้ช่วยถามต่อและแนะนำ Product/Package จากข้อมูลที่มีจริง พร้อมเปิดดูรายการต่อในเว็บแอปได้

**Blocked by:** 04: Admin จัดแพ็กเกจ -> Customer เลือก slot; 06: Staff ลงสินค้า -> Customer จัดตะกร้า.

**Status:** implementation-complete-awaiting-live-acceptance

**Priority:** optional — ทำเมื่อมีเวลาหลังงานหลัก 01–08 ไม่เป็นเงื่อนไขส่ง prototype; เกณฑ์ด้านล่างใช้เมื่อเลือกทำ

**Spec:** [Approved spec](../spec.md)

**Coverage:** User Stories 40-44, ส่วนแชทของ 47; AC16, AC17 และส่วนตั้งค่าแชทของ AC20

## Acceptance criteria

- [x] รับข้อความ LINE ผ่าน webhook ที่ตรวจ signature ก่อนประมวลผล และ event เดิมไม่สร้างผลซ้ำโดยไม่ตั้งใจ (local HTTP test; ดู [report](../../../agent-runs/09-chat-assistance/test-report.md))
- [ ] Customer พิมพ์ข้อความอิสระและถามต่อได้ ผู้ช่วยมีบริบทเพียงพอสำหรับบทสนทนานั้นและถามเพิ่มเมื่อความต้องการยังไม่ชัด
- [ ] คำแนะนำใช้ Product/Package/Service ที่แสดงต่อลูกค้าได้จริงจากฐานข้อมูล และเปิดกลับไปดูรายการที่อ้างถึงในเว็บได้
- [ ] ไม่แต่งชื่อ ราคา วันว่าง เงื่อนไข หรือบริการที่ไม่มีข้อมูลรองรับ หากไม่พบหรือข้อมูลยังไม่พอให้บอกตรง ๆ หรือถามต่อ
- [ ] ไม่เปิดเผยข้อมูลส่วนตัวหรือสิทธิ์หลังบ้านแก่ลูกค้า/โมเดล และไม่ส่งรหัสผ่านหรือ credentials ให้บริการ AI
- [ ] แชทไม่สร้างหรือยืนยัน Order/Booking และไม่จ่ายเงินแทน Customer ขั้นตอนทำรายการยังอยู่ในเว็บตามสเปก
- [ ] บริการ LINE/AI ล้มเหลวหรือส่งไม่สำเร็จต้องไม่รายงานเป็นผลสำเร็จเท็จ และไม่เปลี่ยนข้อมูลธุรกรรมเพื่อกลบความล้มเหลว
- [ ] ผ่านชุดบทสนทนาทดสอบกับข้อมูลที่ทราบคำตอบ รวมถามต่อ ไม่มีข้อมูล ข้อความขอข้อมูลลับ signature ผิด event ซ้ำ และบริการภายนอกล้มเหลว
- [ ] มี live smoke test ของ LINE และโมเดลจริงกับบัญชีทดสอบหลังได้รับอนุญาต ไม่ใช้คำตอบ mock แล้วสรุปว่า AI integration ทำงานแล้ว

## External prerequisites and evidence

- ใช้ Gemini stable Lite chain: `gemini-3.5-flash-lite` แล้วลอง `gemini-3.1-flash-lite` หนึ่งครั้งเมื่อ timeout/capacity response และยังเหลืองบเวลาใน provider budget รวม 8 วินาที; no paid/preview fallback. `GEMINI_MODEL` รับเฉพาะสองรุ่นนี้. เจ้าของยังต้องตั้ง key ที่ Vercel และตรวจ Free Tier/quota แยกตาม Google Project/model ก่อนเปิด flag
- Migration 011 เพิ่ม app-side cap เป็น 50 logical requests ต่อ LINE user และ 1,000 ต่อวัน Asia/Bangkok; หนึ่ง logical request อาจมี provider attempts สูงสุดสองครั้ง. migration 010 และ 011 apply แล้วตามที่เจ้าของอนุญาตเมื่อ 23 ต.ค. 2569; ตรวจนิยาม cap และสิทธิ์ผ่าน SQL Editor แล้ว
- การตั้งค่า Messaging API, webhook และการส่งข้อความจริงต้องตั้งโดยเจ้าของก่อน acceptance; ยังไม่มี live LINE/Gemini test
- ไม่ต้องรอ Order หรือ Booking เสร็จเพราะแชทไม่มีสิทธิ์ทำธุรกรรมแทนผู้ใช้

## Implementation evidence

Implementation is local and default-off. Signature, duplicate-event behavior, constrained model request, whitelisted server rendering, typecheck and SQL migration ACL are recorded in the [Ticket 09 report](../../../agent-runs/09-chat-assistance/test-report.md). Remaining checklist items and live acceptance stay open.
