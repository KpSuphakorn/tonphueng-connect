import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServiceClient } from "./supabase";

export const STAFF_PHOTO_STAGING_BUCKET = "staff-photo-staging";
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const TOKEN_CLEANUP_MARGIN_MS = 5 * 60 * 1000;
const MAX_PHOTOS = 19;

export type StaffPhotoFlow = "registration" | "profile";
export type ClaimedPhotoSession = { id: string; staging_paths: string[]; expires_at: string };

export class StaffPhotoUploadCleanupError extends Error {
  constructor(readonly sessionId: string) {
    super("Could not safely record staged upload token expiry");
    this.name = "StaffPhotoUploadCleanupError";
  }
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function cleanExpiredStaffPhotoUploads() {
  const client = createServiceClient();
  const { data, error } = await client.from("staff_photo_upload_sessions")
    .select("id,staging_paths")
    .lt("token_expires_at", new Date().toISOString())
    .order("token_expires_at", { ascending: true })
    .limit(10);
  if (error) throw new Error("Could not inspect expired photo uploads");
  for (const session of data ?? []) {
    const { error: removeError } = await client.storage.from(STAFF_PHOTO_STAGING_BUCKET).remove(session.staging_paths);
    if (removeError) {
      console.error("Staff staged photo cleanup failed", { sessionId: session.id });
      await client.from("staff_photo_upload_sessions").update({ cleanup_error: "storage_remove_failed" }).eq("id", session.id);
      continue;
    }
    const { error: deleteError } = await client.from("staff_photo_upload_sessions").delete().eq("id", session.id);
    if (deleteError) console.error("Staff staged photo manifest cleanup failed", { sessionId: session.id });
  }
}

export async function issueStaffPhotoUploadSession(flow: StaffPhotoFlow, count: number, accountId: string | null) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PHOTOS) throw new Error("กรุณาเลือก 1–19 รูป");
  await cleanExpiredStaffPhotoUploads();
  const id = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const stagingPaths = Array.from({ length: count }, (_, index) => `${id}/${index + 1}-${randomUUID()}.upload`);
  const client = createServiceClient();
  const { error } = await client.rpc("create_staff_photo_upload_session", {
    target_id: id,
    target_token_hash: tokenHash(token),
    target_flow: flow,
    target_account_id: accountId,
    target_staging_paths: stagingPaths,
  });
  if (error) throw new Error("ไม่สามารถเตรียมการอัปโหลดรูปได้ กรุณาลองอีกครั้งภายหลัง");
  const uploads: Array<{ path: string; signedUrl: string }> = [];
  try {
    for (const path of stagingPaths) {
      const { data, error: signError } = await client.storage.from(STAFF_PHOTO_STAGING_BUCKET).createSignedUploadUrl(path, { upsert: false });
      if (signError || !data?.signedUrl) throw new Error("Could not issue staged photo URL");
      uploads.push({ path, signedUrl: data.signedUrl });
    }
  } catch {
    await client.from("staff_photo_upload_sessions").update({ state: "failed", token_expires_at: new Date(Date.now() + TOKEN_TTL_MS + TOKEN_CLEANUP_MARGIN_MS).toISOString() }).eq("id", id);
    throw new Error("ไม่สามารถเตรียมการอัปโหลดรูปได้ กรุณาลองอีกครั้งภายหลัง");
  }
  const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS + TOKEN_CLEANUP_MARGIN_MS).toISOString();
  const { error: expiryError } = await client.from("staff_photo_upload_sessions").update({ token_expires_at: tokenExpiresAt }).eq("id", id);
  if (expiryError) {
    const { error: fallbackError } = await client.from("staff_photo_upload_sessions")
      .update({ state: "failed", token_expires_at: new Date(Date.now() + TOKEN_TTL_MS + TOKEN_CLEANUP_MARGIN_MS).toISOString() })
      .eq("id", id);
    if (fallbackError) {
      console.error("Staff photo upload token expiry update failed", { sessionId: id });
      throw new StaffPhotoUploadCleanupError(id);
    }
    throw new Error("ไม่สามารถเตรียมการอัปโหลดรูปได้ กรุณาลองอีกครั้งภายหลัง");
  }
  return { session: token, uploads };
}

export async function claimStaffPhotoUploadSession(token: string, flow: StaffPhotoFlow, accountId: string | null) {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const { data, error } = await createServiceClient().rpc("claim_staff_photo_upload_session", {
    target_token_hash: tokenHash(token),
    target_flow: flow,
    target_account_id: accountId,
  });
  if (error || !Array.isArray(data) || data.length !== 1) return null;
  const session = data[0] as ClaimedPhotoSession;
  return Array.isArray(session.staging_paths) && session.staging_paths.length >= 1 && session.staging_paths.length <= MAX_PHOTOS
    ? session
    : null;
}

export async function finishStaffPhotoUploadSession(id: string, state: "completed" | "failed") {
  const { error } = await createServiceClient().from("staff_photo_upload_sessions").update({ state }).eq("id", id);
  if (error) console.error("Staff photo upload session status update failed", { sessionId: id, state });
}
