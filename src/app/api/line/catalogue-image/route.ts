import sharp from "sharp";
import { createServiceClient } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORED_PHOTO = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.webp$/i;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 40_000_000;

type CatalogueKind = "service" | "product" | "package";
type CataloguePhoto = { path: string | null; accountId: string | null; unavailable?: boolean };

function validPhoto(path: unknown, accountId: unknown): path is string {
  if (typeof path !== "string" || typeof accountId !== "string" || !UUID.test(accountId)) return false;
  const match = STORED_PHOTO.exec(path);
  return Boolean(match && match[1].toLowerCase() === accountId.toLowerCase());
}

async function activeStaff(client: ReturnType<typeof createServiceClient>, id: string) {
  const { data, error } = await client.from("app_accounts").select("id")
    .eq("id", id).eq("role", "staff").eq("status", "active").maybeSingle();
  if (error) throw new Error("catalogue_unavailable");
  return Boolean(data);
}

async function cataloguePhoto(client: ReturnType<typeof createServiceClient>, kind: CatalogueKind, id: string): Promise<CataloguePhoto> {
  if (kind === "service") {
    const { data, error } = await client.from("services").select("id,account_id,photo_paths").eq("id", id).maybeSingle();
    if (error) throw new Error("catalogue_unavailable");
    if (!data || !await activeStaff(client, data.account_id)) return { path: null, accountId: null };
    const path = Array.isArray(data.photo_paths) ? data.photo_paths.find((value: unknown) => validPhoto(value, data.account_id)) : null;
    return { path: path ?? null, accountId: data.account_id };
  }

  if (kind === "product") {
    const { data, error } = await client.from("products").select("id,photo_path,services!inner(account_id,category)")
      .eq("id", id).eq("active", true).eq("services.category", "community_product").maybeSingle();
    if (error) throw new Error("catalogue_unavailable");
    const service = data?.services as { account_id?: string; category?: string } | null;
    if (!data || !service?.account_id || !await activeStaff(client, service.account_id)) return { path: null, accountId: null };
    return { path: validPhoto(data.photo_path, service.account_id) ? data.photo_path : null, accountId: service.account_id };
  }

  const { data: catalogs, error } = await client.from("package_catalogs").select("catalog").limit(3);
  if (error) throw new Error("catalogue_unavailable");
  let selected: { slots?: Array<{ service_ids?: unknown }> } | undefined;
  for (const row of catalogs ?? []) {
    const subPackages = (row.catalog as { sub_packages?: unknown } | null)?.sub_packages;
    if (!Array.isArray(subPackages)) continue;
    selected = subPackages.find((item): item is { id?: string; slots?: Array<{ service_ids?: unknown }> } =>
      Boolean(item && typeof item === "object" && (item as { id?: unknown }).id === id));
    if (selected) break;
  }
  if (!selected || !Array.isArray(selected.slots)) return { path: null, accountId: null };
  const rawLinkedIds = selected.slots.flatMap((slot) => {
    if (!slot || typeof slot !== "object" || slot.service_ids === undefined) return [];
    return Array.isArray(slot.service_ids) ? slot.service_ids : [slot.service_ids];
  });
  if (rawLinkedIds.some((serviceId) => typeof serviceId !== "string" || !UUID.test(serviceId))) return { path: null, accountId: null };
  const linkedIds = [...new Set(rawLinkedIds as string[])];
  if (!linkedIds.length) return { path: null, accountId: null };
  const { data: services, error: serviceError } = await client.from("services").select("id,account_id,photo_paths").in("id", linkedIds);
  if (serviceError) throw new Error("catalogue_unavailable");
  const byId = new Map((services ?? []).map((service) => [service.id, service]));
  if (byId.size !== linkedIds.length) return { path: null, accountId: null };
  for (const id of linkedIds) {
    const service = byId.get(id);
    if (!service || !await activeStaff(client, service.account_id)) return { path: null, accountId: null };
  }
  for (const id of linkedIds) {
    const service = byId.get(id)!;
    const path = Array.isArray(service.photo_paths) ? service.photo_paths.find((value: unknown) => validPhoto(value, service.account_id)) : null;
    if (path) return { path, accountId: service.account_id };
  }
  return { path: null, accountId: null };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const allowedKeys = new Set(["kind", "id"]);
  if ([...url.searchParams.keys()].some((key) => !allowedKeys.has(key)) || url.searchParams.getAll("kind").length !== 1 || url.searchParams.getAll("id").length !== 1) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  if (!id || !UUID.test(id) || !["service", "product", "package"].includes(kind ?? "")) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const client = createServiceClient();
    const photo = await cataloguePhoto(client, kind as CatalogueKind, id);
    if (!photo.path || !photo.accountId) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    const { data, error } = await client.storage.from("staff-business-photos").download(photo.path);
    if (error || !data || data.size <= 0 || data.size > MAX_SOURCE_BYTES) throw new Error("photo_unavailable");
    const source = Buffer.from(await data.arrayBuffer());
    if (!source.length || source.length > MAX_SOURCE_BYTES) throw new Error("photo_unavailable");
    const jpeg = await sharp(source, { failOn: "error", limitInputPixels: MAX_SOURCE_PIXELS })
      .resize(800, 600, { fit: "cover", position: "attention", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpeg), { status: 200, headers: {
      "Content-Type": "image/jpeg", "Content-Length": String(jpeg.length), "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
