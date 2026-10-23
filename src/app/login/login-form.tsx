"use client";

import liff from "@line/liff";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon, type IconName } from "../components/icons";
import { PasswordField } from "../components/password-field";
import { useSessionDraft } from "../components/session-draft";

type Role = "customer" | "staff" | "admin";

const roles: Array<{ id: Role; title: string; subtitle: string; icon: IconName }> = [
  { id: "customer", title: "ลูกค้า", subtitle: "เข้าสู่ระบบด้วยบัญชี LINE", icon: "user" },
  { id: "staff", title: "ผู้ประกอบการชุมชน", subtitle: "เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน", icon: "store" },
  { id: "admin", title: "ผู้ดูแลโครงการ", subtitle: "อีเมล รหัสผ่าน และ LINE ที่ผูกกับบัญชี", icon: "shield" },
];

type LoginReply = { error?: string; redirectTo?: string; code?: string };
type LineStatus = "idle" | "connecting" | "connected" | "failed";
const customerIntentKey = "tonphueng-login-intent";
/** Survives the LINE login redirect so the Admin form comes back preselected and continues connecting LINE. */
const adminIntentKey = "tonphueng-admin-login-intent";
const intentLifetimeMs = 5 * 60 * 1000;
let liffInitialization: Promise<void> | undefined;

function hasIntent(key: string) {
  try {
    const value = sessionStorage.getItem(key);
    if (!value) return false;
    const intent = JSON.parse(value) as { expiresAt?: unknown };
    if (typeof intent.expiresAt === "number" && intent.expiresAt > Date.now()) return true;
    sessionStorage.removeItem(key);
  } catch {
    try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
  }
  return false;
}

function saveIntent(key: string) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ expiresAt: Date.now() + intentLifetimeMs }));
    return true;
  } catch {
    return false;
  }
}

function clearIntent(key: string) {
  try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}

/** Last role used on this device (role only, never a token) to preselect the picker next time. */
const lastRoleKey = "tonphueng-last-role";
/** One silent Customer re-login per LINE window, so a failing attempt can never loop. */
const autoLoginAttemptKey = "tonphueng-auto-login-attempted";

function readLastRole(): Role | undefined {
  try {
    const value = localStorage.getItem(lastRoleKey);
    return value === "customer" || value === "staff" || value === "admin" ? value : undefined;
  } catch { return undefined; }
}

function rememberRole(role: Role) {
  try { localStorage.setItem(lastRoleKey, role); } catch { /* Preselection is a convenience only. */ }
}

function claimAutoLoginAttempt() {
  try {
    if (sessionStorage.getItem(autoLoginAttemptKey)) return false;
    sessionStorage.setItem(autoLoginAttemptKey, "1");
    return true;
  } catch { return false; }
}

const hasCustomerIntent = () => hasIntent(customerIntentKey);
const saveCustomerIntent = () => saveIntent(customerIntentKey);
const clearCustomerIntent = () => clearIntent(customerIntentKey);
const hasAdminIntent = () => hasIntent(adminIntentKey);
const clearAdminIntent = () => clearIntent(adminIntentKey);

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

/** `switching` (from `?switch=1`) means the person chose to pick a role again, so no silent re-login. */
export function LoginForm({ switching = false }: { switching?: boolean }) {
  const [role, setRole] = useState<Role>();
  const [autoSigningIn, setAutoSigningIn] = useState(false);
  // Email is remembered per role for this LINE window/tab; the password is never stored.
  const [email, setEmail, clearEmailDraft] = useSessionDraft(`login-email:${role ?? "none"}`, "");
  const [password, setPassword] = useState("");
  const [lineIdToken, setLineIdToken] = useState("");
  const [lineStatus, setLineStatus] = useState<LineStatus>("idle");
  const [lineError, setLineError] = useState("");
  const [acceptanceRequired, setAcceptanceRequired] = useState(false);
  const [acceptAdminRole, setAcceptAdminRole] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const customerSignInStarted = useRef(false);
  const customerAttemptGeneration = useRef(0);
  const callbackResumed = useRef(false);
  const adminAttemptGeneration = useRef(0);
  const adminResumed = useRef(false);

  useEffect(() => {
    const resumingCustomer = hasCustomerIntent();
    if (resumingCustomer) setRole("customer");
    const resumingAdmin = !resumingCustomer && hasAdminIntent();
    if (resumingAdmin) { setRole("admin"); setLineStatus("connecting"); }
    const lastRole = !resumingCustomer && !resumingAdmin ? readLastRole() : undefined;
    if (lastRole) setRole(lastRole);
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
      if (hasAdminIntent()) {
        adminAttemptGeneration.current += 1;
        clearAdminIntent();
        setRole("admin");
        setLineStatus("failed");
        setLineError("การเชื่อม LINE ถูกยกเลิก");
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    void initializeLiff().then(() => {
      if (hasAdminIntent() && !adminResumed.current) {
        adminResumed.current = true;
        void connectAdminLine(true);
        return;
      }
      if (hasCustomerIntent()) {
        if (callbackResumed.current) return;
        callbackResumed.current = true;
        setRole("customer");
        void signInWithLine(true);
        return;
      }
      // Silent Customer re-login inside LINE only: remembered Customer, LINE already signed in, not a deliberate switch.
      if (lastRole === "customer" && !switching && liff.isInClient() && liff.isLoggedIn() && claimAutoLoginAttempt()) {
        if (!saveCustomerIntent()) return;
        callbackResumed.current = true;
        setAutoSigningIn(true);
        void signInWithLine(true).finally(() => setAutoSigningIn(false));
        return;
      }
      // A preselected Admin inside LINE reads the LINE identity without a redirect; outside LINE it waits for a tap.
      if (lastRole === "admin" && liff.isInClient()) void connectAdminLine();
    }).catch(() => {
      clearConsumedLiffError();
      if (hasCustomerIntent()) {
        clearCustomerIntent();
        setRole("customer");
        setMessage("เชื่อมต่อ LINE ไม่สำเร็จ กรุณากดดำเนินการด้วย LINE อีกครั้ง");
      }
      if (hasAdminIntent()) {
        clearAdminIntent();
        setRole("admin");
        setLineStatus("failed");
        setLineError("เชื่อมต่อ LINE ไม่สำเร็จ");
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
      rememberRole("customer");
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

  /** Admin identity comes from LIFF automatically: inside LINE the ID token is read at once; outside LINE the page goes
   * through LINE login and returns here with the Admin role preselected. The server still verifies and binds it. */
  async function connectAdminLine(resuming = false) {
    const attempt = ++adminAttemptGeneration.current;
    setLineIdToken("");
    setLineStatus("connecting");
    setLineError("");
    if (!resuming && !saveIntent(adminIntentKey)) {
      setLineStatus("failed");
      setLineError("ไม่สามารถบันทึกการเข้าสู่ระบบชั่วคราวได้ กรุณาเปิดใช้ session storage");
      return;
    }
    try {
      await initializeLiff();
      if (attempt !== adminAttemptGeneration.current) return;
      if (!liff.isLoggedIn()) {
        if (resuming) throw new Error("ยังไม่ได้เข้าสู่ระบบ LINE การยืนยันอาจถูกยกเลิก");
        if (liff.isInClient()) throw new Error("ยังไม่พบการเข้าสู่ระบบ LINE กรุณาปิดแล้วเปิด LIFF จาก LINE อีกครั้ง");
        liff.login({ redirectUri: window.location.href });
        return;
      }
      const token = liff.getIDToken();
      if (!token) throw new Error("ไม่พบ LINE ID token กรุณาเปิดแอปจาก LINE แล้วลองใหม่");
      clearAdminIntent();
      setLineIdToken(token);
      setLineStatus("connected");
    } catch (error) {
      if (attempt !== adminAttemptGeneration.current) return;
      clearAdminIntent();
      setLineStatus("failed");
      setLineError(error instanceof Error ? error.message : "เชื่อม LINE ไม่สำเร็จ");
    }
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || (role !== "staff" && role !== "admin")) return;
    if (role === "admin" && acceptanceRequired && !acceptAdminRole) return;
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
          ...(role === "admin" ? { lineIdToken, ...(acceptanceRequired && acceptAdminRole ? { acceptAdminRole: true } : {}) } : {}),
        }),
      });
      const result = (await response.json()) as LoginReply;
      if (role === "admin" && result.code === "admin_acceptance_required") {
        setAcceptanceRequired(true);
        setAcceptAdminRole(false);
        return;
      }
      if (!response.ok) throw new Error(result.error || "เข้าสู่ระบบไม่สำเร็จ");
      clearEmailDraft();
      rememberRole(role);
      window.location.assign(result.redirectTo || "/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {autoSigningIn && <p className="line-status line-status-connecting" role="status"><Icon name="user" size={20} /><span><strong>กำลังเข้าสู่ระบบ…</strong><small>ใช้บัญชี LINE ที่เปิดอยู่</small></span></p>}
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
              adminAttemptGeneration.current += 1;
              clearAdminIntent();
              setRole(item.id);
              setMessage("");
              setLineIdToken("");
              setLineStatus("idle");
              setLineError("");
              setAcceptanceRequired(false);
              setAcceptAdminRole(false);
              if (item.id === "admin") void connectAdminLine();
            }}
          >
            <span className="role-icon"><Icon name={item.icon} /></span>
            <span>
              <span className="role-title">{item.title}</span>
              <span className="role-subtitle">{item.subtitle}</span>
            </span>
            <Icon name={role === item.id ? "check" : "chevronRight"} />
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
              disabled={role === "admin" && lineStatus === "connecting"}
              required
              maxLength={254}
              value={email}
              onChange={(event) => { setEmail(event.target.value); setAcceptanceRequired(false); setAcceptAdminRole(false); }}
            />
          </label>
          <PasswordField
            label="รหัสผ่าน"
            name="password"
            autoComplete="current-password"
            disabled={role === "admin" && lineStatus === "connecting"}
            required
            maxLength={512}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {role === "admin" && (
            <div className={`line-status line-status-${lineStatus}`} role="status" aria-live="polite">
              <Icon name={lineStatus === "connected" ? "check" : "shield"} size={20} />
              <span>
                <strong>{lineStatus === "connected" ? "เชื่อม LINE แล้ว" : lineStatus === "failed" ? lineError : lineStatus === "idle" ? "ยังไม่ได้เชื่อม LINE" : "กำลังเชื่อม LINE…"}</strong>
                {lineStatus === "idle" && <button type="button" className="text-button" disabled={busy} onClick={() => void connectAdminLine()}>เชื่อม LINE</button>}
                {lineStatus === "failed" && <button type="button" className="text-button" disabled={busy} onClick={() => void connectAdminLine()}>ลองเชื่อม LINE อีกครั้ง</button>}
                <small>บัญชี LINE จะถูกตรวจจากระบบ LINE และต้องตรงกับบัญชีผู้ดูแลนี้</small>
              </span>
            </div>
          )}
          {role === "admin" && acceptanceRequired && (
            <section className="note-card" aria-labelledby="accept-admin-heading">
              <strong id="accept-admin-heading">ยืนยันรับสิทธิ์ผู้ดูแล</strong>
              <p className="form-help">บัญชีนี้ได้รับเชิญเป็นผู้ดูแลโครงการ เมื่อยืนยัน ระบบจะผูกบัญชี LINE ที่ยืนยันแล้วกับบัญชีผู้ดูแลนี้ และการเข้าสู่ระบบผู้ดูแลครั้งต่อไปต้องใช้ LINE บัญชีเดียวกัน</p>
              <label className="package-choice">
                <input type="checkbox" checked={acceptAdminRole} onChange={(event) => setAcceptAdminRole(event.target.checked)} />
                <span>ฉันยืนยันรับสิทธิ์ผู้ดูแลโครงการและผูกบัญชี LINE นี้ <span className="required-marker" aria-hidden="true">*</span></span>
              </label>
            </section>
          )}
          <button className="button button-primary button-wide" type="submit" disabled={busy || (role === "admin" && (!lineIdToken || (acceptanceRequired && !acceptAdminRole)))}>
            {busy ? "กำลังตรวจสอบ…" : role === "admin" && acceptanceRequired ? "ยืนยันรับสิทธิ์และเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
          </button>
        </form>
      )}

      {message && (
        <p className="error-message" role="status" aria-live="polite">
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
      window.location.assign("/login?switch=1");
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
