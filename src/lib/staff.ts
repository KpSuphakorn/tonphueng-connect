import sharp from "sharp";
import { getAccountForSession, readSessionCookie, type Account } from "./auth";
import { createServiceClient } from "./supabase";

export const STAFF_PHOTO_BUCKET = "staff-business-photos";
export const STAFF_CATEGORIES = ["community_product", "accommodation", "restaurant", "tourism_trail", "other"] as const;
const MAX_PHOTO_COUNT = 19;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_PHOTO_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_FORM_BYTES = 64 * 1024;

export class StaffFormError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "StaffFormError";
  }
}

export class StaffPhotoUploadError extends Error {
  constructor(readonly uploadedPaths: string[]) {
    super("Could not save business photos");
    this.name = "StaffPhotoUploadError";
  }
}

export async function readStaffForm(request: Request): Promise<FormData> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_FORM_BYTES) {
    throw new StaffFormError(413, "ข้อมูลรวมมีขนาดใหญ่เกินไป");
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_FORM_BYTES) {
        try { await reader.cancel(); } catch { /* The size limit already decides this request. */ }
        throw new StaffFormError(413, "ข้อมูลรวมมีขนาดใหญ่เกินไป");
      }
      chunks.push(value);
    }
  }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  try {
    return await new Request(request.url, { method: "POST", headers, body: new Uint8Array(Buffer.concat(chunks)) }).formData();
  } catch {
    throw new StaffFormError(400, "ข้อมูลสมัครไม่ถูกต้อง");
  }
}

export type StaffProfile = {
  id: string;
  account_id: string;
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  category: (typeof STAFF_CATEGORIES)[number];
  other_category: string | null;
  photo_paths: string[];
};

export type StaffDetails = Omit<StaffProfile, "photo_paths"> & { photos: string[] };

export function formProfile(form: FormData) {
  const name = form.get("name");
  const description = form.get("description");
  const address = form.get("address");
  const rawLatitude = form.get("latitude");
  const rawLongitude = form.get("longitude");
  const latitude = typeof rawLatitude === "string" && rawLatitude.trim() ? Number(rawLatitude) : Number.NaN;
  const longitude = typeof rawLongitude === "string" && rawLongitude.trim() ? Number(rawLongitude) : Number.NaN;
  const phone = form.get("phone");
  const category = form.get("category");
  const otherCategory = form.get("other_category");
  if (
    typeof name !== "string" || !name.trim() || name.trim().length > 160 ||
    (description !== null && (typeof description !== "string" || description.length > 4000)) ||
    typeof address !== "string" || !address.trim() || address.trim().length > 1000 ||
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    typeof phone !== "string" || !phone.trim() || phone.trim().length > 40 ||
    typeof category !== "string" || !STAFF_CATEGORIES.includes(category as (typeof STAFF_CATEGORIES)[number]) ||
    (category === "other" && (typeof otherCategory !== "string" || !otherCategory.trim() || otherCategory.trim().length > 120))
  ) return null;
  return {
    name: name.trim(),
    description: typeof description === "string" ? description.trim() : "",
    address: address.trim(),
    latitude,
    longitude,
    phone: phone.trim(),
    category: category as (typeof STAFF_CATEGORIES)[number],
    other_category: category === "other" ? (otherCategory as string).trim() : null,
  };
}

export async function validatePhotoBuffers(inputs: Buffer[]) {
  if (inputs.length > MAX_PHOTO_COUNT) throw new Error("กรุณาแนบรูปภาพไม่เกิน 19 รูป");
  let totalBytes = 0;
  const result: Buffer[] = [];
  for (const input of inputs) {
    if (!input.length || input.length > MAX_PHOTO_BYTES) throw new Error("รูปภาพแต่ละไฟล์ต้องมีขนาดไม่เกิน 5 MB");
    totalBytes += input.length;
    if (totalBytes > MAX_TOTAL_PHOTO_BYTES) throw new Error("รูปภาพทั้งหมดต้องมีขนาดรวมไม่เกิน 25 MB");
    try {
      const image = sharp(input, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS || !["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
        throw new Error("unsupported image");
      }
      result.push(await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer());
    } catch {
      throw new Error("รองรับเฉพาะรูป JPG, PNG หรือ WebP ที่เปิดอ่านได้");
    }
  }
  return result;
}

export async function readStagedStaffPhotos(paths: string[]) {
  if (!paths.length || paths.length > MAX_PHOTO_COUNT) throw new Error("กรุณาแนบรูปกิจการ 1–19 รูป");
  const client = createServiceClient();
  const buffers: Buffer[] = [];
  let total = 0;
  for (const path of paths) {
    const { data, error } = await client.storage.from("staff-photo-staging").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) throw new Error("Could not read staged business photo");
    const response = await fetch(data.signedUrl, { cache: "no-store", redirect: "error" });
    if (!response.ok || !response.body) throw new Error("Could not read staged business photo");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        total += value.byteLength;
        if (size > MAX_PHOTO_BYTES || total > MAX_TOTAL_PHOTO_BYTES) {
          await reader.cancel();
          throw new Error(size > MAX_PHOTO_BYTES ? "รูปภาพแต่ละไฟล์ต้องมีขนาดไม่เกิน 5 MB" : "รูปภาพทั้งหมดต้องมีขนาดรวมไม่เกิน 25 MB");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (!size) throw new Error("รูปภาพไม่ถูกต้อง");
    buffers.push(Buffer.concat(chunks, size));
  }
  return validatePhotoBuffers(buffers);
}

export async function requireStaff(request: Request): Promise<Account | null> {
  const account = await getAccountForSession(readSessionCookie(request));
  return account?.role === "staff" && account.status === "active" ? account : null;
}

export async function requireAdmin(request: Request): Promise<Account | null> {
  const account = await getAccountForSession(readSessionCookie(request));
  // Pending (unaccepted/unbound) Admins never pass; the app_accounts check constraint guarantees an active Admin has a bound LINE subject.
  return account?.role === "admin" && account.status === "active" ? account : null;
}

export async function signedPhotos(paths: string[]) {
  if (!paths.length) return [];
  const { data, error } = await createServiceClient().storage.from(STAFF_PHOTO_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) throw new Error("Could not load business photos");
  return data.map((photo) => photo.signedUrl).filter((url): url is string => Boolean(url));
}

export async function getStaffDetails(profile: StaffProfile): Promise<StaffDetails> {
  const { photo_paths, ...details } = profile;
  return { ...details, photos: await signedPhotos(photo_paths) };
}

export async function uploadStaffPhotos(accountId: string, buffers: Buffer[]) {
  const client = createServiceClient();
  const paths: string[] = [];
  for (const buffer of buffers) {
    const path = `${accountId}/${crypto.randomUUID()}.webp`;
    paths.push(path);
    try {
      const { error } = await client.storage.from(STAFF_PHOTO_BUCKET).upload(path, buffer, {
        contentType: "image/webp",
        upsert: false,
      });
      if (error) throw error;
    } catch {
      throw new StaffPhotoUploadError(paths);
    }
  }
  return paths;
}

export async function deleteStaffPhotos(paths: string[]) {
  if (!paths.length) return;
  const { error } = await createServiceClient().storage.from(STAFF_PHOTO_BUCKET).remove(paths);
  if (error) throw new Error("Could not clean up business photos");
}
