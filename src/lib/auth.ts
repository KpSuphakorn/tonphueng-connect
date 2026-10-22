import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createServiceClient } from "./supabase";

export const SESSION_COOKIE = "tonphueng_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export type AccountRole = "customer" | "staff" | "admin";
export type Account = {
  id: string;
  role: AccountRole;
  status: "active" | "pending" | "disabled";
  line_subject: string | null;
  auth_user_id: string | null;
};

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function findAccountByLineSubject(subject: string, role: AccountRole = "customer") {
  const { data, error } = await createServiceClient()
    .from("app_accounts")
    .select("id,role,status,line_subject,auth_user_id")
    .eq("line_subject", subject)
    .eq("role", role)
    .maybeSingle();
  if (error) throw new Error("Could not read account");
  return data as Account | null;
}

export async function findAccountByAuthUserId(userId: string) {
  const { data, error } = await createServiceClient()
    .from("app_accounts")
    .select("id,role,status,line_subject,auth_user_id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not read account");
  return data as Account | null;
}

export async function createCustomerAccount(subject: string): Promise<Account> {
  const existing = await findAccountByLineSubject(subject);
  if (existing) {
    if (existing.role !== "customer" || existing.status !== "active") {
      throw new AuthError("ไม่สามารถใช้บัญชีนี้ในฐานะลูกค้าได้", 403);
    }
    return existing;
  }

  const { data, error } = await createServiceClient()
    .from("app_accounts")
    .insert({ role: "customer", status: "active", line_subject: subject })
    .select("id,role,status,line_subject,auth_user_id")
    .single();
  if (error?.code === "23505") {
    const raced = await findAccountByLineSubject(subject, "customer");
    if (raced?.role === "customer" && raced.status === "active") return raced;
  }
  if (error || !data) throw new Error("Could not create customer account");
  return data as Account;
}

export async function createSession(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1_000).toISOString();
  const { error } = await createServiceClient().from("app_sessions").insert({
    account_id: accountId,
    token_hash: digest(token),
    expires_at: expiresAt,
  });
  if (error) throw new Error("Could not create session");
  return token;
}

export async function revokeSession(token: string) {
  const { error } = await createServiceClient()
    .from("app_sessions")
    .delete()
    .eq("token_hash", digest(token));
  if (error) throw new Error("Could not revoke session");
}

export async function getAccountForSession(token: string | undefined): Promise<Account | null> {
  if (!token || token.length > 128) return null;
  try {
    const { data, error } = await createServiceClient()
      .from("app_sessions")
      .select("expires_at,app_accounts(id,role,status,line_subject,auth_user_id)")
      .eq("token_hash", digest(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data || !data.app_accounts) return null;
    return data.app_accounts as unknown as Account;
  } catch {
    return null;
  }
}

export async function getAccountFromCookies() {
  const cookieStore = await cookies();
  return getAccountForSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export function appendSessionCookie(headers: Headers, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`,
  );
}

export function appendClearedSessionCookie(headers: Headers) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`,
  );
}

export function readSessionCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const item of cookieHeader.split(";")) {
    const [name, ...value] = item.trim().split("=");
    if (name === SESSION_COOKIE) return value.join("=");
  }
  return undefined;
}

export function hasValidSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = process.env.APP_ORIGIN?.trim();
  if (!origin) return false;
  if (process.env.NODE_ENV === "production" && !configured) return false;
  try {
    const expected = configured || new URL(request.url).origin;
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

export function validJsonPost(request: Request) {
  return (
    request.method === "POST" &&
    hasValidSameOrigin(request) &&
    request.headers.get("content-type")?.toLowerCase().startsWith("application/json") === true
  );
}
