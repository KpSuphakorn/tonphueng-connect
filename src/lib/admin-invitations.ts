import { createServiceClient } from "./supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AdminInviteResult = { outcome: "created" | "existing_user"; email: string };
export type AdminListItem = { id: string; email: string; status: "active" | "pending" | "disabled"; created_at: string };
export class AdminInvitationError extends Error {
  constructor(readonly code: "admin_exists" | "auth_create_failed" | "account_create_failed" | "cleanup_failed" | "lookup_failed", message: string) {
    super(message);
    this.name = "AdminInvitationError";
  }
}

/** Accepts exactly { email, password }; the initial password needs 12–128 characters like the bootstrap Admin. */
export function parseAdminInvite(value: unknown): { email: string; password: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "email,password" || typeof input.email !== "string" || typeof input.password !== "string") return null;
  const email = input.email.trim().toLowerCase();
  const length = Array.from(input.password).length;
  if (!EMAIL.test(email) || email.length > 254 || length < 12 || length > 128) return null;
  return { email, password: input.password };
}

async function findAuthUserIdByEmail(email: string) {
  const client = createServiceClient();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1_000 });
    if (error) throw new AdminInvitationError("lookup_failed", "Could not read Auth users");
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 1_000) return null;
  }
  return null;
}

/**
 * Adds a pending Admin row. A new email gets a new Auth user with the initial password; an existing Auth user
 * (for example a Staff) keeps its current password. The invitee activates the role only by accepting it and
 * binding a verified LINE identity at login.
 */
export async function inviteAdmin(email: string, password: string): Promise<AdminInviteResult> {
  const client = createServiceClient();
  const existingId = await findAuthUserIdByEmail(email);
  let createdId: string | null = null;
  let authUserId = existingId;
  if (!authUserId) {
    const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new AdminInvitationError("auth_create_failed", "Could not create Auth user");
    createdId = data.user.id;
    authUserId = createdId;
  } else {
    const { data: current, error } = await client.from("app_accounts").select("id").eq("role", "admin").eq("auth_user_id", authUserId).maybeSingle();
    if (error) throw new AdminInvitationError("lookup_failed", "Could not read Admin accounts");
    if (current) throw new AdminInvitationError("admin_exists", "Admin already exists");
  }
  const { error: insertError } = await client.from("app_accounts").insert({ role: "admin", status: "pending", auth_user_id: authUserId, line_subject: null });
  if (insertError) {
    if (createdId) {
      let cleaned = false;
      try { cleaned = !(await client.auth.admin.deleteUser(createdId)).error; } catch { /* Reported below. */ }
      if (!cleaned) {
        console.error("Admin invitation cleanup required", { authUserId: createdId });
        throw new AdminInvitationError("cleanup_failed", "Auth user cleanup failed");
      }
    }
    if (insertError.code === "23505") throw new AdminInvitationError("admin_exists", "Admin already exists");
    throw new AdminInvitationError("account_create_failed", "Could not create pending Admin");
  }
  return { outcome: createdId ? "created" : "existing_user", email };
}

export async function listAdmins(): Promise<AdminListItem[]> {
  const client = createServiceClient();
  const { data, error } = await client.from("app_accounts").select("id,status,auth_user_id,created_at").eq("role", "admin").order("created_at", { ascending: true });
  if (error) throw new Error("Could not read Admin accounts");
  return Promise.all((data ?? []).map(async (row) => {
    const { data: user } = row.auth_user_id ? await client.auth.admin.getUserById(row.auth_user_id) : { data: { user: null } };
    return { id: row.id, status: row.status, created_at: row.created_at, email: user?.user?.email ?? "ไม่พบอีเมล" } as AdminListItem;
  }));
}
