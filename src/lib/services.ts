import { getAccountForSession, readSessionCookie, type Account } from "./auth";
import { signedPhotos, STAFF_CATEGORIES, type StaffProfile } from "./staff";
import { createServiceClient } from "./supabase";

export type ServiceCategory = (typeof STAFF_CATEGORIES)[number];
export type PublicService = Omit<StaffProfile, "account_id" | "photo_paths"> & {
  photos: string[];
};

const PAGE_SIZE = 12;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SERVICE_FIELDS = "id,name,description,address,latitude,longitude,phone,category,other_category,photo_paths,created_at";

export function parseServiceCategory(value: string | null): ServiceCategory | null {
  return value && STAFF_CATEGORIES.includes(value as ServiceCategory) ? value as ServiceCategory : null;
}

export function parseCoordinate(value: string | null, min: number, max: number) {
  if (value === null) return null;
  const number = Number(value);
  return value.trim() !== "" && Number.isFinite(number) && number >= min && number <= max ? number : NaN;
}

async function activeStaffIds() {
  const client = createServiceClient();
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from("app_accounts").select("id")
      .eq("role", "staff").eq("status", "active").order("id").range(from, from + 999);
    if (error) throw new Error("Could not read active Staff accounts");
    ids.push(...(data ?? []).map((row) => row.id));
    if (!data || data.length < 1000) return ids;
  }
}

async function activeServiceRows(category?: ServiceCategory | null) {
  const ids = await activeStaffIds();
  if (!ids.length) return [] as StaffProfile[];
  const client = createServiceClient();
  const rows: StaffProfile[] = [];
  for (let from = 0; ; from += 1000) {
    let query = client.from("services").select(SERVICE_FIELDS).in("account_id", ids).order("id").range(from, from + 999);
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) throw new Error("Could not read Services");
    rows.push(...((data ?? []) as unknown as StaffProfile[]));
    if (!data || data.length < 1000) return rows;
  }
}

async function publicService(profile: StaffProfile): Promise<PublicService> {
  const { account_id: _accountId, photo_paths, ...fields } = profile;
  return { ...fields, photos: await signedPhotos(photo_paths ?? []) };
}

export function straightLineDistanceKm(latitude: number, longitude: number, service: Pick<StaffProfile, "latitude" | "longitude">) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(service.latitude - latitude);
  const dLon = radians(service.longitude - longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(service.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function listServices(category: ServiceCategory | null, offset: number, latitude: number | null, longitude: number | null) {
  // shortcut: load the filtered catalogue to keep GPS order global across pages; move distance sorting into Postgres if the catalogue grows substantially.
  const rows = await activeServiceRows(category);
  if (latitude !== null && longitude !== null) {
    rows.sort((a, b) => straightLineDistanceKm(latitude, longitude, a) - straightLineDistanceKm(latitude, longitude, b) || a.id.localeCompare(b.id));
  }
  const page = rows.slice(offset, offset + PAGE_SIZE);
  return { services: await Promise.all(page.map(publicService)), hasMore: offset + page.length < rows.length };
}

export async function getActiveService(id: string) {
  if (!UUID.test(id)) return null;
  const activeIds = await activeStaffIds();
  if (!activeIds.length) return null;
  const { data, error } = await createServiceClient().from("services").select(SERVICE_FIELDS)
    .eq("id", id).in("account_id", activeIds).maybeSingle();
  if (error) throw new Error("Could not read Service");
  return data ? publicService(data as unknown as StaffProfile) : null;
}

export function validServiceId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export async function requireCustomer(request: Request): Promise<Account | null> {
  const account = await getAccountForSession(readSessionCookie(request));
  return account?.role === "customer" && account.status === "active" ? account : null;
}

export async function getSavedServices(accountId: string) {
  const { data: saved, error } = await createServiceClient().from("my_trip_saved_services")
    .select("service_id,created_at").eq("customer_account_id", accountId).order("created_at", { ascending: false });
  if (error) throw new Error("Could not read My Trip");
  if (!saved?.length) return [];
  const activeIds = await activeStaffIds();
  if (!activeIds.length) return [];
  const { data: rows, error: serviceError } = await createServiceClient().from("services").select(SERVICE_FIELDS)
    .in("account_id", activeIds).in("id", saved.map((row) => row.service_id));
  if (serviceError) throw new Error("Could not read saved Services");
  const byId = new Map((rows ?? []).map((row) => [row.id, row as unknown as StaffProfile]));
  return Promise.all(saved.flatMap((row) => {
    const profile = byId.get(row.service_id);
    return profile ? [publicService(profile).then((service) => ({ ...service, saved_at: row.created_at }))] : [];
  }));
}

export { PAGE_SIZE };
