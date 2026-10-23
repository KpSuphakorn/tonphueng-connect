"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordField } from "../../components/password-field";
import { useSessionDraft } from "../../components/session-draft";

export function AddAdminForm() {
  const router = useRouter();
  const [email, setEmail, clearEmailDraft] = useSessionDraft("admin-add-email", "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/admin/admins", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "เพิ่มผู้ดูแลไม่สำเร็จ");
      setEmail(""); clearEmailDraft(); setPassword(""); setMessage(result.message || "เพิ่มผู้ดูแลแล้ว"); router.refresh();
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "เพิ่มผู้ดูแลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <form className="form-stack" onSubmit={submit} aria-labelledby="add-admin-heading">
    <h2 id="add-admin-heading">เพิ่มผู้ดูแล</h2>
    <label className="field"><span>อีเมลผู้ดูแลใหม่ <span className="required-marker" aria-hidden="true">*</span></span><input type="email" required maxLength={254} autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <PasswordField label={<span>รหัสผ่านเริ่มต้น <span className="required-marker" aria-hidden="true">*</span></span>} required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
    <p className="form-help">อย่างน้อย 12 ตัวอักษร แจ้งผู้รับผ่านช่องทางส่วนตัว หากอีเมลนี้มีบัญชีในระบบอยู่แล้ว ระบบจะไม่เปลี่ยนรหัสผ่านเดิม <span className="required-marker" aria-hidden="true">*</span> จำเป็นต้องกรอก</p>
    <button className="button button-primary" type="submit" disabled={busy}>{busy ? "กำลังเพิ่ม…" : "เพิ่มผู้ดูแล"}</button>
    {message && <p className={failed ? "error-message" : "success-message"} role="status">{message}</p>}
  </form>;
}
