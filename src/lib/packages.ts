import { createServiceClient } from "./supabase";
import { STAFF_CATEGORIES } from "./staff";

export const PACKAGE_CATEGORIES = [
  { id: "trail_running", title: "Trail & Running" },
  { id: "wildfire_study", title: "Wild Fire Study" },
  { id: "cultural_study_trip", title: "Cultural Study Trip" },
] as const;
export type PackageCategory = (typeof PACKAGE_CATEGORIES)[number]["id"];
export const PACKAGE_CATEGORY_IDS = PACKAGE_CATEGORIES.map(({ id }) => id);
export type PackageService = { id: string; name: string; category: (typeof STAFF_CATEGORIES)[number] };
export type PackageSlot = { id: string; name: string; service_category: PackageService["category"]; required_count: number; service_ids: string[] };
export type SubPackage = { id: string; title: string; description: string; price_per_person_satang: number; slots: PackageSlot[] };
export type PackageCatalog = { title: string; description: string; contact_url: string; sub_packages: SubPackage[] };
export type CatalogRow = { category: PackageCategory; catalog: PackageCatalog; revision: number };

export class PackageCatalogConflictError extends Error {
  constructor() { super("แพ็กเกจถูกแก้ไขแล้ว กรุณาโหลดหน้าใหม่ก่อนบันทึก"); }
}
export class PackageCatalogInputError extends Error {
  constructor() { super("ตัวเลือกของแต่ละ slot ต้องเป็นบริการที่เปิดใช้งานและตรงประเภท"); }
}
export class PackageRequestTooLargeError extends Error {}

export async function readBoundedPackageJson(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        try { await reader.cancel(); } catch { /* Size limit already decides the request. */ }
        throw new PackageRequestTooLargeError();
      }
      chunks.push(value);
    }
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const serviceCategories = new Set<string>(STAFF_CATEGORIES);
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export function isPackageCategory(value: unknown): value is PackageCategory {
  return typeof value === "string" && PACKAGE_CATEGORY_IDS.includes(value as PackageCategory);
}

export function validatePackageCatalog(value: unknown): PackageCatalog | null {
  if (!isRecord(value) || typeof value.title !== "string" || !value.title.trim() || value.title.trim().length > 160 ||
    typeof value.description !== "string" || value.description.length > 4000 ||
    typeof value.contact_url !== "string" || value.contact_url.length > 500 ||
    !Array.isArray(value.sub_packages) || value.sub_packages.length > 12) return null;
  let contactUrl = "";
  if (value.contact_url.trim()) {
    try {
      const parsed = new URL(value.contact_url.trim());
      if (parsed.protocol !== "https:") return null;
      contactUrl = parsed.toString();
    } catch { return null; }
  }
  const subPackages: SubPackage[] = [];
  for (const item of value.sub_packages) {
    if (!isRecord(item) || typeof item.id !== "string" || !uuid.test(item.id) ||
      typeof item.title !== "string" || !item.title.trim() || item.title.trim().length > 160 ||
      typeof item.description !== "string" || item.description.length > 4000 ||
      !Number.isSafeInteger(item.price_per_person_satang) || Number(item.price_per_person_satang) < 1 || Number(item.price_per_person_satang) > 100_000_000 ||
      !Array.isArray(item.slots) || item.slots.length < 1 || item.slots.length > 12) return null;
    const slots: PackageSlot[] = [];
    const slotIds = new Set<string>();
    for (const rawSlot of item.slots) {
      if (!isRecord(rawSlot) || typeof rawSlot.id !== "string" || !uuid.test(rawSlot.id) || slotIds.has(rawSlot.id) ||
        typeof rawSlot.name !== "string" || !rawSlot.name.trim() || rawSlot.name.trim().length > 100 ||
        typeof rawSlot.service_category !== "string" || !serviceCategories.has(rawSlot.service_category) ||
        !Number.isSafeInteger(rawSlot.required_count) || Number(rawSlot.required_count) < 1 || Number(rawSlot.required_count) > 10 ||
        !Array.isArray(rawSlot.service_ids) || rawSlot.service_ids.length < Number(rawSlot.required_count) || rawSlot.service_ids.length > 100 ||
        rawSlot.service_ids.some((id) => typeof id !== "string" || !uuid.test(id)) || new Set(rawSlot.service_ids).size !== rawSlot.service_ids.length) return null;
      slotIds.add(rawSlot.id);
      slots.push({ id: rawSlot.id, name: rawSlot.name.trim(), service_category: rawSlot.service_category as PackageSlot["service_category"], required_count: Number(rawSlot.required_count), service_ids: rawSlot.service_ids as string[] });
    }
    subPackages.push({ id: item.id, title: item.title.trim(), description: item.description.trim(), price_per_person_satang: Number(item.price_per_person_satang), slots });
  }
  if (new Set(subPackages.map((item) => item.id)).size !== subPackages.length) return null;
  return { title: value.title.trim(), description: value.description.trim(), contact_url: contactUrl, sub_packages: subPackages };
}

export function validateSelections(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return null;
  const seenSlots = new Set<string>();
  const selections: Array<{ slot_id: string; service_ids: string[] }> = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.slot_id !== "string" || !uuid.test(item.slot_id) || seenSlots.has(item.slot_id) ||
      !Array.isArray(item.service_ids) || item.service_ids.length < 1 || item.service_ids.length > 10 ||
      item.service_ids.some((id) => typeof id !== "string" || !uuid.test(id)) || new Set(item.service_ids).size !== item.service_ids.length) return null;
    seenSlots.add(item.slot_id);
    selections.push({ slot_id: item.slot_id, service_ids: item.service_ids as string[] });
  }
  return selections;
}

async function catalogRows(): Promise<CatalogRow[]> {
  const { data, error } = await createServiceClient().from("package_catalogs").select("category,catalog,revision").order("category");
  if (error) throw new Error("Could not load package catalogs");
  return (data ?? []).flatMap((row) => {
    if (!isPackageCategory(row.category)) return [];
    const catalog = validatePackageCatalog(row.catalog);
    return catalog ? [{ category: row.category, catalog, revision: Number(row.revision) }] : [];
  });
}

async function activePackageServices(ids: string[]): Promise<PackageService[]> {
  if (!ids.length) return [];
  const client = createServiceClient();
  const { data: services, error } = await client.from("services").select("id,name,account_id,category").in("id", ids);
  if (error) throw new Error("Could not load package services");
  const staffIds = [...new Set((services ?? []).map((service) => service.account_id))];
  if (!staffIds.length) return [];
  const { data: active, error: activeError } = await client.from("app_accounts").select("id")
    .in("id", staffIds).eq("role", "staff").eq("status", "active");
  if (activeError) throw new Error("Could not verify package services");
  const activeIds = new Set((active ?? []).map((account) => account.id));
  return (services ?? []).filter((service) => activeIds.has(service.account_id) && serviceCategories.has(service.category))
    .map((service) => ({ id: service.id, name: service.name, category: service.category }));
}

export async function getAdminPackageData() {
  const [rows, servicesResult] = await Promise.all([
    catalogRows(),
    createServiceClient().from("services").select("id,name,account_id,category"),
  ]);
  if (servicesResult.error) throw new Error("Could not load package services");
  const services = servicesResult.data ?? [];
  const staffIds = [...new Set(services.map((service) => service.account_id))];
  const activeResult = staffIds.length
    ? await createServiceClient().from("app_accounts").select("id").in("id", staffIds).eq("role", "staff").eq("status", "active")
    : { data: [], error: null };
  if (activeResult.error) throw new Error("Could not verify package services");
  const activeIds = new Set((activeResult.data ?? []).map((account) => account.id));
  const availableServices: PackageService[] = services.filter((service) => activeIds.has(service.account_id) && serviceCategories.has(service.category))
    .map((service) => ({ id: service.id, name: service.name, category: service.category }));
  return {
    catalogs: PACKAGE_CATEGORIES.map((category) => rows.find((row) => row.category === category.id) ?? {
      category: category.id, revision: 0,
      catalog: { title: category.title, description: "", contact_url: "", sub_packages: [] },
    }),
    services: availableServices,
  };
}

export async function getPublicPackageData() {
  const rows = await catalogRows();
  const ids = [...new Set(rows.flatMap((row) => row.catalog.sub_packages.flatMap((subPackage) => subPackage.slots.flatMap((slot) => slot.service_ids))))];
  const services = await activePackageServices(ids);
  const byId = new Map(services.map((service) => [service.id, service]));
  return PACKAGE_CATEGORIES.map((category) => {
    const row = rows.find((item) => item.category === category.id);
    const catalog = row?.catalog ?? { title: category.title, description: "", contact_url: "", sub_packages: [] };
    return {
      category: category.id,
      category_title: category.title,
      revision: row?.revision ?? 0,
      title: catalog.title,
      description: catalog.description,
      contact_url: catalog.contact_url,
      sub_packages: catalog.sub_packages.map((subPackage) => ({
        ...subPackage,
        slots: subPackage.slots.map((slot) => ({ ...slot, options: slot.service_ids.map((id) => byId.get(id)).filter((service): service is PackageService => Boolean(service && service.category === slot.service_category)) })),
      })),
    };
  });
}

export async function savePackageCatalog(category: PackageCategory, catalog: PackageCatalog, revision: number) {
  const ids = [...new Set(catalog.sub_packages.flatMap((subPackage) => subPackage.slots.flatMap((slot) => slot.service_ids)))];
  const services = await activePackageServices(ids);
  const byId = new Map(services.map((service) => [service.id, service]));
  for (const subPackage of catalog.sub_packages) for (const slot of subPackage.slots) {
    if (slot.service_ids.length < slot.required_count || slot.service_ids.some((id) => byId.get(id)?.category !== slot.service_category)) {
      throw new PackageCatalogInputError();
    }
  }
  const { data, error } = await createServiceClient().rpc("save_package_catalog", { target_category: category, target_expected_revision: revision, target_catalog: catalog });
  if (error?.code === "40001") throw new PackageCatalogConflictError();
  if (error || !Number.isSafeInteger(Number(data)) || Number(data) < 1) throw new Error("Could not save package catalog");
  return Number(data);
}

export async function saveCustomerPackageSelection(customerId: string, category: PackageCategory, subPackageId: string, revision: number, choices: Array<{ slot_id: string; service_ids: string[] }>) {
  const { data, error } = await createServiceClient().rpc("save_package_selection", {
    target_customer_id: customerId,
    target_category: category,
    target_sub_package_id: subPackageId,
    target_revision: revision,
    target_choices: choices,
  });
  if (error || !Array.isArray(data) || data.length !== 1) throw new Error("Could not save package selection");
  return data[0] as { id: string; catalog_revision: number; price_per_person_satang: number; choices: typeof choices };
}

export async function getCustomerPackageSelections(customerId: string) {
  const { data, error } = await createServiceClient().from("package_customer_selections")
    .select("id,category,sub_package_id,catalog_revision,price_per_person_satang,choices,updated_at")
    .eq("customer_account_id", customerId).order("updated_at", { ascending: false });
  if (error) throw new Error("Could not load package selections");
  return data ?? [];
}
