"use client";

import liff from "@line/liff";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Role = "customer" | "staff" | "admin";

const roles: Array<{ id: Role; title: string; subtitle: string }> = [
  { id: "customer", title: "ลูกค้า", subtitle: "เข้าสู่ระบบด้วยบัญชี LINE" },
  { id: "staff", title: "ผู้ประกอบการชุมชน", subtitle: "เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน" },
  { id: "admin", title: "ผู้ดูแลโครงการ", subtitle: "อีเมล รหัสผ่าน และ LINE ที่ผูกกับบัญชี" },
];

type LoginReply = { error?: string; redirectTo?: string };
const customerIntentKey = "tonphueng-login-intent";
const customerIntentLifetimeMs = 5 * 60 * 1000;
let liffInitialization: Promise<void> | undefined;

function hasCustomerIntent() {
  try {
    const value = sessionStorage.getItem(customerIntentKey);
    if (!value) return false;
    const intent = JSON.parse(value) as { expiresAt?: unknown };
    if (typeof intent.expiresAt === "number" && intent.expiresAt > Date.now()) return true;
    sessionStorage.removeItem(customerIntentKey);
  } catch {
    try { sessionStorage.removeItem(customerIntentKey); } catch { /* Storage may be unavailable. */ }
  }
  return false;
}

function saveCustomerIntent() {
  try {
    sessionStorage.setItem(customerIntentKey, JSON.stringify({ expiresAt: Date.now() + customerIntentLifetimeMs }));
    return true;
  } catch {
    return false;
  }
}

function clearCustomerIntent() {
  try { sessionStorage.removeItem(customerIntentKey); } catch { /* Storage may be unavailable. */ }
}

function clearConsumedLiffError() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("liffOAuth2Error") !== "true" || !url.searchParams.has("error")) return;
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  url.searchParams.delete("liffOAuth2Error");
  window.history.replaceState(window.history.state, "", url);
}

function initializeLiff() {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  if (!liffId || liffId.startsWith("replace_with_")) {
    return Promise.reject(new Error("ยังไม่ได้ตั้งค่า LIFF ID สำหรับระบบนี้"));
  }
  if (!liffInitialization) {
    liffInitialization = liff.init({ liffId }).catch((error: unknown) => {
      liffInitialization = undefined;
      throw error;
    });
  }
  return liffInitialization;
}

export function LoginForm() {
  const [role, setRole] = useState<Role>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lineIdToken, setLineIdToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const customerSignInStarted = useRef(false);
  const customerAttemptGeneration = useRef(0);
  const callbackResumed = useRef(false);

  useEffect(() => {
    const resumingCustomer = hasCustomerIntent();
    if (resumingCustomer) setRole("customer");
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      customerAttemptGeneration.current += 1;
      customerSignInStarted.current = false;
      setBusy(false);
      if (hasCustomerIntent()) {
        clearCustomerIntent();
        setRole("customer");
        setMessage("การเข้าสู่ระบบ LINE ถูกยกเลิก กรุณากดดำเนินการด้วย LINE อีกครั้ง");
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    void initializeLiff().then(() => {
      if (!hasCustomerIntent() || callbackResumed.current) return;
      callbackResumed.current = true;
      setRole("customer");
      void signInWithLine(true);
    }).catch(() => {
      clearConsumedLiffError();
      if (hasCustomerIntent()) {
        clearCustomerIntent();
        setRole("customer");
        setMessage("เชื่อมต่อ LINE ไม่สำเร็จ กรุณากดดำเนินการด้วย LINE อีกครั้ง");
      }
    });
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  async function getLineToken(attempt?: number, resumingCustomer = false) {
    await initializeLiff();
    if (attempt !== undefined && (attempt !== customerAttemptGeneration.current || !hasCustomerIntent())) return undefined;
    if (!liff.isLoggedIn()) {
      if (resumingCustomer) throw new Error("ยังไม่ได้เข้าสู่ระบบ LINE การยืนยันอาจถูกยกเลิก กรุณาลองอีกครั้ง");
      if (liff.isInClient()) throw new Error("ยังไม่พบการเข้าสู่ระบบ LINE กรุณาปิดแล้วเปิด LIFF จาก LINE อีกครั้ง");
      liff.login({ redirectUri: window.location.href });
      return undefined;
    }
    const token = liff.getIDToken();
    if (!token) throw new Error("ไม่พบ LINE ID token กรุณาเปิดแอปจาก LINE แล้วลองใหม่");
    return token;
  }

  async function signInWithLine(resumingCustomer = false) {
    if (customerSignInStarted.current) return;
    customerSignInStarted.current = true;
    const attempt = ++customerAttemptGeneration.current;
    setBusy(true);
    setMessage("");
    let redirectingToLine = false;
    try {
      const idToken = await getLineToken(attempt, resumingCustomer);
      if (attempt !== customerAttemptGeneration.current) return;
      if (!idToken) {
        if (hasCustomerIntent()) redirectingToLine = true;
        else setMessage("การเข้าสู่ระบบชั่วคราวหมดอายุ กรุณากดดำเนินการด้วย LINE อีกครั้ง");
        return;
      }
      if ((!resumingCustomer && role !== "customer") || !hasCustomerIntent()) return;
      const response = await fetch("/api/auth/line", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const result = (await response.json()) as LoginReply;
      if (attempt !== customerAttemptGeneration.current || !hasCustomerIntent()) return;
      if (!response.ok) throw new Error(result.error || "เข้าสู่ระบบไม่สำเร็จ");
      clearCustomerIntent();
      window.location.assign(result.redirectTo || "/");
    } catch (error) {
      if (attempt === customerAttemptGeneration.current) {
        clearCustomerIntent();
        setMessage(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
      }
    } finally {
      if (attempt === customerAttemptGeneration.current && !redirectingToLine) {
        customerSignInStarted.current = false;
        setBusy(false);
      }
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
            disabled={busy}
            aria-pressed={role === item.id}
            onClick={() => {
              if (item.id !== "customer") {
                customerAttemptGeneration.current += 1;
                customerSignInStarted.current = false;
                clearCustomerIntent();
              }
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
          <button className="button button-primary button-wide" type="button" disabled={busy} onClick={() => {
            if (!saveCustomerIntent()) {
              setMessage("ไม่สามารถบันทึกการเข้าสู่ระบบชั่วคราวได้ กรุณาเปิดใช้ session storage แล้วลองอีกครั้ง");
              return;
            }
            void signInWithLine();
          }}>
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
