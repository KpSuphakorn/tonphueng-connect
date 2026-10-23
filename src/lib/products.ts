import { createServiceClient } from "./supabase";
import { signedPhotos } from "./staff";
import type { Product, ProductStore } from "./product-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_FIELDS = "id,service_id,name,description,price_satang,photo_path,updated_at";
const STORE_FIELDS = "id,name,address,category,account_id";

export function isProductId(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }

export function parseProductPriceBaht(value: string) {
  const clean = value.trim();
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(clean)) return null;
  const [baht, fraction = ""] = clean.split(".");
  const amount = Number(baht) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 100_000_000 ? amount : null;
}

async function activeCommunityStores() {
  const client = createServiceClient();
  const { data: staff, error: staffError } = await client.from("app_accounts").select("id")
    .eq("role", "staff").eq("status", "active");
  if (staffError) throw new Error("Could not read active Staff accounts");
  if (!staff?.length) return [] as Array<{ id: string; name: string; address: string; account_id: string }>;
  const { data, error } = await client.from("services").select(STORE_FIELDS)
    .eq("category", "community_product").in("account_id", staff.map((row) => row.id)).order("name");
  if (error) throw new Error("Could not read product stores");
  return (data ?? []) as Array<{ id: string; name: string; address: string; account_id: string }>;
}

export async function listProductStores(): Promise<ProductStore[]> {
  const stores = await activeCommunityStores();
  if (!stores.length) return [];
  const { data, error } = await createServiceClient().from("products").select("service_id")
    .eq("active", true).in("service_id", stores.map((store) => store.id));
  if (error) throw new Error("Could not read products");
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.service_id, (counts.get(row.service_id) ?? 0) + 1);
  return stores.map(({ id, name, address }) => ({ id, name, address, product_count: counts.get(id) ?? 0 }));
}

export async function listProductsForStore(serviceId: string): Promise<Product[] | null> {
  if (!isProductId(serviceId)) return null;
  const store = (await activeCommunityStores()).find((item) => item.id === serviceId);
  if (!store) return null;
  const { data, error } = await createServiceClient().from("products").select(PRODUCT_FIELDS)
    .eq("service_id", serviceId).eq("active", true).order("created_at", { ascending: false });
  if (error) throw new Error("Could not read products");
  return Promise.all((data ?? []).map(async (row) => {
    const urls = await signedPhotos([row.photo_path]);
    return { id: row.id, service_id: row.service_id, name: row.name, description: row.description, price_satang: row.price_satang, photo_url: urls[0] ?? "", updated_at: row.updated_at };
  }));
}

export async function listStaffProducts(accountId: string): Promise<Product[]> {
  const client = createServiceClient();
  const { data: service, error: serviceError } = await client.from("services").select("id,category")
    .eq("account_id", accountId).maybeSingle();
  if (serviceError) throw new Error("Could not read Staff store");
  if (!service || service.category !== "community_product") return [];
  const { data, error } = await client.from("products").select(PRODUCT_FIELDS)
    .eq("service_id", service.id).eq("active", true).order("updated_at", { ascending: false });
  if (error) throw new Error("Could not read Staff products");
  return Promise.all((data ?? []).map(async (row) => ({
    id: row.id, service_id: row.service_id, name: row.name, description: row.description,
    price_satang: row.price_satang, photo_url: (await signedPhotos([row.photo_path]))[0] ?? "", updated_at: row.updated_at,
  })));
}

export async function saveStaffProduct(accountId: string, input: { id?: string; name: string; description: string; price_satang: number; photo_path?: string; keep_photo: boolean }) {
  const { data, error } = await createServiceClient().rpc("save_staff_product", {
    target_account_id: accountId, target_product_id: input.id ?? null, target_name: input.name,
    target_description: input.description, target_price_satang: input.price_satang,
    target_photo_path: input.photo_path ?? null, target_keep_photo: input.keep_photo,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function archiveStaffProduct(accountId: string, productId: string) {
  const { error } = await createServiceClient().rpc("archive_staff_product", { target_account_id: accountId, target_product_id: productId });
  if (error) throw error;
}
