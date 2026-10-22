# 02: สมัคร Staff -> Admin อนุมัติ -> เข้าใช้งาน

**What to build:** ผู้ประกอบการสมัครพร้อมข้อมูลกิจการและรูปภาพ Admin เปิดตรวจและอนุมัติ แล้ว Staff จึงเข้าใช้งานกิจการของตนได้

**Blocked by:** 01: เข้าสู่ระบบและตรวจสิทธิ์แต่ละบทบาท.

**Status:** implementation-complete-awaiting-live-acceptance

**Spec:** [Approved spec](../spec.md)

**Coverage:** User Stories 26-29, 33, 35; AC02, AC03 และส่วนข้อมูลบัญชี/กิจการของ AC14-AC15

## Acceptance criteria

- [ ] Staff Register เก็บชื่อ ที่อยู่ข้อความ GPS เบอร์โทร ประเภทกิจการ รูปภาพ อีเมล และรหัสผ่านตามสเปก โดยไม่เก็บหรือเปิดเผยรหัสผ่านเป็นข้อความธรรมดา
- [ ] มีหมวดสินค้าชุมชน ที่พัก ร้านอาหาร การท่องเที่ยว/เส้นทางเดินป่า และอื่น ๆ พร้อมข้อความระบุหมวดอื่น
- [ ] รูปกิจการมีจำนวนน้อยกว่า 20 รูป ปฏิเสธตั้งแต่ 20 รูปขึ้นไปและตรวจไฟล์ที่รับเข้าบน server ด้วย
- [ ] การสมัครสร้างบัญชี/ข้อมูลกิจการจริงในสถานะรออนุมัติ และไม่ยอมให้ผู้สมัครกำหนดสถานะอนุมัติหรือบทบาท Admin เอง
- [ ] ผู้สมัครเห็นว่ารออนุมัติและยังใช้สิทธิ์ Staff ไม่ได้ แม้เรียกข้อมูลจัดการโดยตรง
- [ ] Admin ที่ผ่านการตรวจครบเปิดข้อมูลผู้สมัครและอนุมัติได้ จากนั้น Staff เข้าจัดการกิจการของตนได้
- [ ] Staff อ่านหรือแก้ข้อมูลกิจการของ Staff อื่นไม่ได้; การบันทึกและอนุมัติยังอยู่หลังโหลดหน้าใหม่
- [ ] ผ่านการทดสอบสมัคร -> รอ -> อนุมัติ -> เข้าจัดการ รวมรูปเกินจำนวน ข้อมูลไม่ครบ และการข้ามการตรวจสิทธิ์

## External prerequisites and evidence

- ใช้ข้อมูลและรูปที่เจ้าของอนุญาตสำหรับสาธิต; การเขียนไปบัญชีบริการจริงต้องได้รับอนุญาต
- บันทึกผลทดสอบผ่าน browser และผลที่อ่านกลับจากการบันทึก ไม่ถือเพียงข้อความแจ้งสำเร็จเป็นหลักฐานว่าข้อมูลถูกเก็บ

## Comments

- 2026-10-22: Local implementation is frozen for independent review. HTTP boundary tests and Playwright use local external-service doubles; no real Supabase or LINE requests were made. See [Ticket 02 local validation](../../../agent-runs/02-staff-approval/test-report.md). The migration remains unapplied, so live integration and owner-controlled acceptance are pending.
- 2026-10-22: Review corrections applied: actual multipart streams are capped, cleanup failures return safe recovery references, new registration requires a decoded photo, Admin sees the Auth email, and replacement photos are preserved after an ambiguous profile write. Revalidation passed: 20 Vitest tests, 4 Playwright tests, typecheck, production build, and diff check. Mobile screenshots were refreshed at `/tmp/tonphueng-staff-register-mobile.png` and `/tmp/tonphueng-admin-approval-mobile.png`. Evidence and limits are in [Ticket 02 local validation](../../../agent-runs/02-staff-approval/test-report.md). No remote services or migration were touched; real Supabase integration and owner acceptance remain pending.
- 2026-10-22: Final ambiguity corrections treat any failed/uncertain Service INSERT or profile PATCH response as potentially committed and preserve account/photo state for inspection; HTTP-double tests simulate a committed write followed by 502. Partial upload cleanup includes the attempted object path. Final revalidation: 21 Vitest, 4 Playwright, typecheck, production build, and diff check passed. Admin email is Auth-stored (not claimed verified). See updated [validation report](../../../agent-runs/02-staff-approval/test-report.md); no live services were used.
- 2026-10-22: Fresh targeted review passed Standards and Spec with no blocking findings. Ticket remains `implementation-complete-awaiting-live-acceptance`; migration 002 and live acceptance remain pending. No Ticket 02 commit or push was made.
- 2026-10-22: Migration 002 was applied manually in a transaction to the intended Supabase project. Verified the `services` table/RLS, denied browser-role access, private photo bucket and limit, and non-public approval RPC. No account/photo data was seeded. Live Auth/Storage acceptance is still pending HTTPS hosting and LIFF setup; Ticket 02 remains uncommitted and unpushed.
- 2026-10-23: Vercel upload adaptation is implemented locally: browsers send binary images directly to private Supabase staging through server-issued path-scoped upload URLs, while Staff endpoints claim a one-use session, stream/decode images server-side, and retain canonical-photo ambiguity safeguards. Migration 004 remains local and unapplied; hosted CORS, Supabase Storage/Auth, Vercel, and LINE acceptance remain pending. See the appended validation evidence in [the existing report](../../../agent-runs/02-staff-approval/test-report.md).

- 2026-10-23: Fresh Vercel upload review passed Standards/Spec with no blocking findings. Final source passed 33 Vitest tests, typecheck, and diff check; four browser tests and production build passed before the final narrow expiry-error correction (covered by the final unit suite). With explicit owner authorization, migration 004 was applied to the intended project and its private bucket, RLS/grants, owner/flow binding, one-use claim, expiry, and profile quota were verified through SQL; synthetic probe rows were rolled back. Original Ticket 02 is locally committed as `aec0c9c`; Ticket 03/upload adaptation remain uncommitted and all these changes remain unpushed. Real Storage/CORS/Auth/LINE and Vercel acceptance remain pending. See [validation evidence](../../../agent-runs/02-staff-approval/test-report.md).
