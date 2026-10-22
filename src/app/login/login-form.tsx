"use client";

import liff from "@line/liff";
import { useState, type FormEvent } from "react";

type Role = "customer" | "staff" | "admin";

const roles: Array<{ id: Role; title: string; subtitle: string }> = [
  { id: "customer", title: "ลูกค้า", subtitle: "เข้าสู่ระบบด้วยบัญชี LINE" },
  { id: "staff", title: "ผู้ประกอบการชุมชน", subtitle: "เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน" },
  { id: "admin", title: "ผู้ดูแลโครงการ", subtitle: "อีเมล รหัสผ่าน และ LINE ที่ผูกกับบัญชี" },
];

type LoginReply = { error?: string; redirectTo?: string };

export function LoginForm() {
  const [role, setRole] = useState<Role>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lineIdToken, setLineIdToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function getLineToken() {
    const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
    if (!liffId || liffId.startsWith("replace_with_")) {
      throw new Error("ยังไม่ได้ตั้งค่า LIFF ID สำหรับระบบนี้");
    }
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href });
      return undefined;
    }
    const token = liff.getIDToken();
    if (!token) throw new Error("ไม่พบ LINE ID token กรุณาเปิดแอปจาก LINE แล้วลองใหม่");
    return token;
  }

  async function signInWithLine() {
    setBusy(true);
    setMessage("");
    try {
      const idToken = await getLineToken();
      if (!idToken) return;
      const response = await fetch("/api/auth/line", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const result = (await response.json()) as LoginReply;
      if (!response.ok) throw new Error(result.error || "เข้าสู่ระบบไม่สำเร็จ");
      window.location.assign(result.redirectTo || "/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  async function connectAdminLine() {
    setBusy(true);
    setMessage("");
    try {
      const token = await getLineToken();
      if (!token) return;
      setLineIdToken(token);
      setMessage("ยืนยัน LINE แล้ว กรุณากดเข้าสู่ระบบเพื่อไปต่อ");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ยืนยัน LINE ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || (role !== "staff" && role !== "admin")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role,
          email,
          password,
          ...(role === "admin" ? { lineIdToken } : {}),
        }),
      });
      const result = (await response.json()) as LoginReply;
      if (!response.ok) throw new Error(result.error || "เข้าสู่ระบบไม่สำเร็จ");
      window.location.assign(result.redirectTo || "/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="role-options" aria-label="ประเภทบัญชี">
        {roles.map((item) => (
          <button
            key={item.id}
            type="button"
            className="role-button"
            aria-pressed={role === item.id}
            onClick={() => {
              setRole(item.id);
              setMessage("");
              setLineIdToken("");
            }}
          >
            <span>
              <span className="role-title" style={{ display: "block" }}>{item.title}</span>
              <span className="role-subtitle">{item.subtitle}</span>
            </span>
            <span aria-hidden="true">{role === item.id ? "✓" : "›"}</span>
          </button>
        ))}
      </div>

      {role === "customer" && (
        <div className="form-stack">
          <p className="form-help">ไม่ต้องสมัครสมาชิกหรือกรอกข้อมูลส่วนตัว ระบบจะรับตัวตนจาก LINE โดยตรง</p>
          <button className="button button-primary button-wide" type="button" disabled={busy} onClick={signInWithLine}>
            {busy ? "กำลังเชื่อมต่อ LINE…" : "ดำเนินการด้วย LINE"}
          </button>
        </div>
      )}

      {(role === "staff" || role === "admin") && (
        <form className="form-stack" onSubmit={signInWithPassword}>
          <label className="field">
            อีเมล
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            รหัสผ่าน
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={512}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {role === "admin" && (
            <>
              <button className="button button-secondary button-wide" type="button" disabled={busy} onClick={connectAdminLine}>
                {lineIdToken ? "ยืนยัน LINE แล้ว" : "ยืนยันบัญชี LINE ที่ผูกไว้"}
              </button>
              <p className="form-help">บัญชี LINE จะถูกตรวจจากระบบ LINE และต้องตรงกับบัญชีผู้ดูแลนี้</p>
            </>
          )}
          <button className="button button-primary button-wide" type="submit" disabled={busy || (role === "admin" && !lineIdToken)}>
            {busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>
      )}

      {message && (
        <p className={message.startsWith("ยืนยัน LINE แล้ว") ? "success-message" : "error-message"} role="status" aria-live="polite" style={{ marginTop: 14 }}>
          {message}
        </p>
      )}
      <p className="provider-note">การเข้าสู่ระบบผู้ประกอบการและผู้ดูแลจะตรวจสิทธิ์จากบัญชีที่บันทึกไว้ในระบบ</p>
    </div>
  );
}

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
      window.location.assign("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
      setBusy(false);
    }
  }

  return (
    <span>
      <button className="top-link" type="button" disabled={busy} onClick={logout}>
        {busy ? "กำลังออก…" : "ออกจากระบบ"}
      </button>
      {error && <span className="error-message" role="status">{error}</span>}
    </span>
  );
}
