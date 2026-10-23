// Idempotent demo-data seed for the prototype (see docs/setup.md "Demo data").
//   npm run seed-demo -- --dry-run                         validate locally, no network
//   DEMO_STAFF_PASSWORD=... npm run seed-demo              create/update demo data
//   npm run seed-demo -- --remove                          delete everything this script created
//   npm run seed-demo -- --delete-test-store <id> [--yes]  delete one old test store
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { PACKAGE_CATEGORIES, validatePackageCatalog, type PackageCatalog, type PackageCategory, type SubPackage } from "../src/lib/packages";
import { STAFF_PHOTO_BUCKET, validatePhotoBuffers } from "../src/lib/staff";
import { createServiceClient } from "../src/lib/supabase";
import {
  DEMO_AUTH_MARKER, DEMO_BOUNDS, DEMO_PACKAGES, DEMO_SERVICES, PACKAGE_PRICE_RANGE_SATANG, PHOTO_CREDITS,
  PRODUCT_PRICE_RANGE_SATANG, photoCreditLine, type DemoPackageCategory, type DemoService, type DemoServiceCategory,
} from "./demo-data/catalog";

export const PHOTO_DIR = path.resolve(process.cwd(), "scripts/demo-data/photos");
const MAX_SOURCE_PHOTO_BYTES = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEMO_CATEGORIES: DemoServiceCategory[] = ["community_product", "accommodation", "restaurant", "tourism_trail"];
const DEMO_SUB_PACKAGE_IDS = new Set(DEMO_PACKAGES.flatMap((item) => item.sub_packages.map((sub) => sub.id)));

type Log = (line: string) => void;
type Counts = Record<string, number>;
type DbError = { message?: string; code?: string } | null;

const bump = (counts: Counts, key: string, by = 1) => { counts[key] = (counts[key] ?? 0) + by; };
type Success<R extends { data: unknown }> = [Extract<R, { error: null }>] extends [never] ? NonNullable<R["data"]> : Extract<R, { error: null }>["data"];
function must<R extends { data: unknown; error: DbError }>(result: R, what: string): Success<R> {
  if (result.error) throw new Error(`${what} failed${result.error.code ? ` [${result.error.code}]` : ""}: ${result.error.message ?? "unknown error"}`);
  return result.data as Success<R>;
}
function printCounts(log: Log, title: string, counts: Counts) {
  log(`\n${title}`);
  for (const [key, value] of Object.entries(counts).sort()) log(`  ${key.padEnd(32)} ${value}`);
}

// ---------- Local catalog validation (also used by --dry-run) ----------

export function validateCatalog(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const unique = (value: string, label: string) => { if (ids.has(value)) problems.push(`Duplicate ${label}: ${value}`); ids.add(value); };
  for (const category of DEMO_CATEGORIES) {
    const count = DEMO_SERVICES.filter((service) => service.category === category).length;
    if (count !== 3) problems.push(`${category}: expected 3 services, found ${count}`);
  }
  if (DEMO_SERVICES.length !== 12) problems.push(`Expected 12 services, found ${DEMO_SERVICES.length}`);
  const referenced = new Set<string>();
  for (const service of DEMO_SERVICES) {
    const where = `service ${service.key}`;
    if (!UUID.test(service.id)) problems.push(`${where}: invalid id`);
    unique(service.id, "id"); unique(service.email, "email"); unique(service.key, "key");
    if (!new RegExp(`^demo-${service.category}-[1-3]@example\\.com$`).test(service.email)) problems.push(`${where}: unexpected email ${service.email}`);
    if (!service.name.trim() || service.name.length > 160) problems.push(`${where}: name must be 1–160 characters`);
    if (service.description.length > 4000) problems.push(`${where}: description longer than 4000 characters`);
    if (!service.description.endsWith(photoCreditLine(service.photos))) problems.push(`${where}: description must end with the photo credit line`);
    if (!service.address.trim() || service.address.length > 1000) problems.push(`${where}: address must be 1–1000 characters`);
    if (!service.phone.trim() || service.phone.length > 40) problems.push(`${where}: phone must be 1–40 characters`);
    if (service.latitude < DEMO_BOUNDS.minLatitude || service.latitude > DEMO_BOUNDS.maxLatitude ||
      service.longitude < DEMO_BOUNDS.minLongitude || service.longitude > DEMO_BOUNDS.maxLongitude) problems.push(`${where}: coordinates outside the demo area`);
    if (service.photos.length !== 2) problems.push(`${where}: expected 2 business photos`);
    service.photos.forEach((file) => referenced.add(file));
    const expectedProducts = service.category === "community_product" ? 3 : 0;
    if (service.products.length !== expectedProducts) problems.push(`${where}: expected ${expectedProducts} products, found ${service.products.length}`);
    for (const product of service.products) {
      const at = `product ${product.photo}`;
      if (!UUID.test(product.id)) problems.push(`${at}: invalid id`);
      unique(product.id, "id");
      if (!product.name.trim() || product.name.length > 160) problems.push(`${at}: name must be 1–160 characters`);
      if (product.description.length > 4000 || !product.description.endsWith(photoCreditLine([product.photo]))) problems.push(`${at}: description too long or missing photo credit line`);
      if (!Number.isSafeInteger(product.price_satang) || product.price_satang < PRODUCT_PRICE_RANGE_SATANG.min || product.price_satang > PRODUCT_PRICE_RANGE_SATANG.max) {
        problems.push(`${at}: price ${product.price_satang} satang outside the demo range`);
      }
      referenced.add(product.photo);
    }
  }
  const credited = new Set(PHOTO_CREDITS.map((credit) => credit.file));
  for (const file of referenced) if (!credited.has(file)) problems.push(`Missing credit for ${file}`);
  for (const file of credited) if (!referenced.has(file)) problems.push(`Credit for unused photo ${file}`);
  for (const category of PACKAGE_CATEGORIES) {
    const entries = DEMO_PACKAGES.filter((item) => item.category === category.id);
    if (entries.length !== 1) { problems.push(`Package ${category.id}: expected one demo entry, found ${entries.length}`); continue; }
    const entry = entries[0];
    if (!entry.description.trim()) problems.push(`Package ${category.id}: description is empty`);
    if (entry.sub_packages.length < 1 || entry.sub_packages.length > 2) problems.push(`Package ${category.id}: expected 1–2 Sub Packages`);
    for (const sub of entry.sub_packages) {
      unique(sub.id, "id");
      if (!sub.title.trim() || !sub.description.trim()) problems.push(`Sub Package ${sub.id}: title and description are required`);
      if (sub.price_per_person_satang < PACKAGE_PRICE_RANGE_SATANG.min || sub.price_per_person_satang > PACKAGE_PRICE_RANGE_SATANG.max) problems.push(`Sub Package ${sub.title}: price outside the demo range`);
      for (const slot of sub.slots) unique(slot.id, "id");
    }
    const demoSubs = buildDemoSubPackages(entry, servicesByCategory(DEMO_SERVICES.map((service) => ({ id: service.id, category: service.category }))));
    const merged = mergeDemoCatalog(category.id, null, entry, demoSubs);
    if ("skip" in merged || !validatePackageCatalog(merged.catalog)) problems.push(`Package ${category.id}: catalog fails the app validator`);
  }
  return problems;
}

// ---------- Photos ----------

type PreparedPhoto = { file: string; objectName: string; sourceBytes: number; webp: Buffer };
const preparedPhotos = new Map<string, Promise<PreparedPhoto>>();

/** Deterministic `<uuid>.webp` name from the source file name and bytes, so reruns find existing uploads. */
export function photoObjectName(file: string, source: Buffer) {
  const hex = createHash("sha256").update(file).update("\0").update(createHash("sha256").update(source).digest()).digest("hex");
  const variant = (8 | (Number.parseInt(hex[16], 16) & 3)).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}.webp`;
}

export function preparePhoto(file: string): Promise<PreparedPhoto> {
  let prepared = preparedPhotos.get(file);
  if (!prepared) {
    prepared = (async () => {
      const source = await readFile(path.join(PHOTO_DIR, file)).catch(() => { throw new Error(`Photo file missing: scripts/demo-data/photos/${file}`); });
      if (source.length > MAX_SOURCE_PHOTO_BYTES) throw new Error(`Photo ${file} is larger than 5 MB`);
      // Same decode/normalise path as Staff uploads in the app (JPEG -> WebP).
      const [webp] = await validatePhotoBuffers([source]).catch((error: unknown) => {
        throw new Error(`Photo ${file} could not be converted: ${error instanceof Error ? error.message : "unknown error"}`);
      });
      return { file, objectName: photoObjectName(file, source), sourceBytes: source.length, webp };
    })();
    preparedPhotos.set(file, prepared);
  }
  return prepared;
}

async function listFolder(client: SupabaseClient, folder: string): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const data = must(await client.storage.from(STAFF_PHOTO_BUCKET).list(folder, { limit: 1000, offset }), `List photos in ${folder}`) ?? [];
    names.push(...data.map((item: { name: string }) => item.name));
    if (data.length < 1000) return names;
  }
}

async function removeObjects(client: SupabaseClient, paths: string[]) {
  for (let index = 0; index < paths.length; index += 100) {
    must(await client.storage.from(STAFF_PHOTO_BUCKET).remove(paths.slice(index, index + 100)), "Remove photos");
  }
}

// ---------- Packages ----------

function servicesByCategory(services: Array<{ id: string; category: string }>) {
  const map = new Map<string, string[]>();
  for (const service of services) map.set(service.category, [...(map.get(service.category) ?? []), service.id]);
  return map;
}

export function buildDemoSubPackages(entry: DemoPackageCategory, byCategory: Map<string, string[]>): SubPackage[] {
  return entry.sub_packages.map((sub) => ({
    id: sub.id, title: sub.title, description: sub.description,
    price_per_person_satang: sub.price_per_person_satang, duration_days: sub.duration_days,
    slots: sub.slots.map((slot) => {
      const ids = byCategory.get(slot.service_category) ?? [];
      if (!ids.length) throw new Error(`No demo services for slot category ${slot.service_category}`);
      return { id: slot.id, name: slot.name, service_category: slot.service_category, required_count: 1, service_ids: ids };
    }),
  }));
}

/** Keeps every non-demo Sub Package and Package text; replaces only this script's Sub Packages (fixed ids). */
export function mergeDemoCatalog(category: PackageCategory, existing: PackageCatalog | null, entry: DemoPackageCategory, demoSubs: SubPackage[]):
  { catalog: PackageCatalog } | { skip: string } {
  const title = PACKAGE_CATEGORIES.find((item) => item.id === category)?.title ?? category;
  const base = existing ?? { title, description: "", contact_url: "", sub_packages: [] };
  const kept = base.sub_packages.filter((sub) => !DEMO_SUB_PACKAGE_IDS.has(sub.id));
  if (kept.length + demoSubs.length > 12) return { skip: `${kept.length} existing Sub Packages leave no room for ${demoSubs.length} demo ones (max 12)` };
  return { catalog: { ...base, description: base.description.trim() ? base.description : entry.description, sub_packages: [...kept, ...demoSubs] } };
}

export function stripDemoCatalog(existing: PackageCatalog, entry: DemoPackageCategory): PackageCatalog {
  return {
    ...existing,
    description: existing.description === entry.description.trim() ? "" : existing.description,
    sub_packages: existing.sub_packages.filter((sub) => !DEMO_SUB_PACKAGE_IDS.has(sub.id)),
  };
}

const sameCatalog = (a: PackageCatalog, b: PackageCatalog) => JSON.stringify(validatePackageCatalog(a)) === JSON.stringify(validatePackageCatalog(b));

async function loadCatalogRows(client: SupabaseClient) {
  const rows = must(await client.from("package_catalogs").select("category,catalog,revision"), "Read package catalogs") ?? [];
  return new Map<string, { catalog: unknown; revision: number }>(rows.map((row: { category: string; catalog: unknown; revision: number }) => [row.category, { catalog: row.catalog, revision: Number(row.revision) }]));
}

async function saveCatalog(client: SupabaseClient, category: PackageCategory, catalog: PackageCatalog, revision: number) {
  const valid = validatePackageCatalog(catalog);
  if (!valid) throw new Error(`Package catalog ${category} would fail the app validator; nothing saved for it.`);
  const { data, error } = await client.rpc("save_package_catalog", { target_category: category, target_expected_revision: revision, target_catalog: valid });
  if (error?.code === "40001") throw new Error(`Package catalog ${category} changed while the script was running. Rerun the command.`);
  must({ data, error }, `Save package catalog ${category}`);
}

// ---------- Auth helpers ----------

async function listAllUsers(client: SupabaseClient) {
  const users = new Map<string, User>();
  for (let page = 1; page <= 50; page += 1) {
    const data = must(await client.auth.admin.listUsers({ page, perPage: 1000 }), "List Auth users");
    for (const user of data.users) if (user.email) users.set(user.email.toLowerCase(), user);
    if (data.users.length < 1000) return users;
  }
  throw new Error("Too many Auth users to scan safely.");
}
const isDemoUser = (user: User) => user.app_metadata?.[DEMO_AUTH_MARKER] === true;
const isDemoEmail = (email: string) => DEMO_SERVICES.some((service) => service.email === email.toLowerCase()) || /^demo-[a-z_]+-\d+@example\.com$/i.test(email);

// ---------- Seed ----------

export async function seedDemo(client: SupabaseClient, password: string, log: Log = console.log) {
  const problems = validateCatalog();
  if (problems.length) throw new Error(`Demo catalog is invalid:\n  - ${problems.join("\n  - ")}`);
  if (Array.from(password).length < 12 || Array.from(password).length > 72) throw new Error("DEMO_STAFF_PASSWORD must be 12–72 characters.");
  const counts: Counts = {};
  const users = await listAllUsers(client);
  const seeded: Array<{ id: string; category: string }> = [];

  for (const def of DEMO_SERVICES) {
    let user = users.get(def.email);
    if (user && !isDemoUser(user)) throw new Error(`${def.email} belongs to an Auth user this script did not create; refusing to change it.`);
    if (!user) {
      const created = must(await client.auth.admin.createUser({ email: def.email, password, email_confirm: true, app_metadata: { [DEMO_AUTH_MARKER]: true } }), `Create Auth user ${def.email}`);
      user = created.user as User;
      bump(counts, "auth users created");
    } else {
      must(await client.auth.admin.updateUserById(user.id, { password, email_confirm: true }), `Update Auth user ${def.email}`);
      bump(counts, "auth users password synced");
    }

    let account = must(await client.from("app_accounts").select("id,status").eq("role", "staff").eq("auth_user_id", user.id).maybeSingle(), `Read Staff account ${def.email}`) as { id: string; status: string } | null;
    if (!account) {
      account = must(await client.from("app_accounts").insert({ role: "staff", status: "active", auth_user_id: user.id, line_subject: null }).select("id,status").single(), `Create Staff account ${def.email}`) as { id: string; status: string };
      bump(counts, "staff accounts created");
    } else if (account.status !== "active") {
      must(await client.from("app_accounts").update({ status: "active" }).eq("id", account.id), `Activate Staff account ${def.email}`);
      bump(counts, "staff accounts reactivated");
    } else bump(counts, "staff accounts unchanged");

    const folder = new Set(await listFolder(client, account.id));
    const ensurePhoto = async (file: string) => {
      const photo = await preparePhoto(file);
      const objectPath = `${account.id}/${photo.objectName}`;
      if (folder.has(photo.objectName)) { bump(counts, "photos already present"); return objectPath; }
      const { error } = await client.storage.from(STAFF_PHOTO_BUCKET).upload(objectPath, photo.webp, { contentType: "image/webp", upsert: false });
      if (error && !/exist|duplicate/i.test(error.message)) throw new Error(`Upload ${file} for ${def.email} failed: ${error.message}`);
      folder.add(photo.objectName);
      bump(counts, error ? "photos already present" : "photos uploaded");
      return objectPath;
    };

    const photoPaths = [];
    for (const file of def.photos) photoPaths.push(await ensurePhoto(file));
    const fields = {
      name: def.name, description: def.description, address: def.address, latitude: def.latitude, longitude: def.longitude,
      phone: def.phone, category: def.category, other_category: null, photo_paths: photoPaths,
    };
    const existingService = must(await client.from("services").select("id,name,description,address,latitude,longitude,phone,category,other_category,photo_paths").eq("account_id", account.id).maybeSingle(), `Read Service for ${def.email}`) as (typeof fields & { id: string }) | null;
    let serviceId: string;
    if (!existingService) {
      serviceId = (must(await client.from("services").insert({ id: def.id, account_id: account.id, ...fields }).select("id").single(), `Create Service ${def.name}`) as { id: string }).id;
      bump(counts, "services created");
    } else {
      serviceId = existingService.id;
      const changed = (Object.keys(fields) as Array<keyof typeof fields>).some((key) => JSON.stringify(existingService[key]) !== JSON.stringify(fields[key]));
      if (changed) {
        must(await client.from("services").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", serviceId), `Update Service ${def.name}`);
        bump(counts, "services updated");
      } else bump(counts, "services unchanged");
    }
    seeded.push({ id: serviceId, category: def.category });

    const storeProducts = must(await client.from("products").select("id,service_id,name,description,price_satang,photo_path,active").eq("service_id", serviceId), `Read products of ${def.name}`) as Array<{ id: string; service_id: string; name: string; description: string; price_satang: number; photo_path: string; active: boolean }>;
    if (def.products.length) {
      const elsewhere = must(await client.from("products").select("id,service_id").in("id", def.products.map((product) => product.id)), "Check demo product ids") as Array<{ id: string; service_id: string }>;
      const conflict = elsewhere.find((row) => row.service_id !== serviceId);
      if (conflict) throw new Error(`Demo product id ${conflict.id} already belongs to another store; refusing to change it.`);
    }
    for (const product of def.products) {
      const desired = { name: product.name, description: product.description, price_satang: product.price_satang, photo_path: await ensurePhoto(product.photo), active: true };
      const row = storeProducts.find((item) => item.id === product.id);
      if (!row) {
        must(await client.from("products").insert({ id: product.id, service_id: serviceId, ...desired }), `Create product ${product.name}`);
        storeProducts.push({ id: product.id, service_id: serviceId, ...desired });
        bump(counts, "products created");
      } else if ((Object.keys(desired) as Array<keyof typeof desired>).some((key) => row[key] !== desired[key])) {
        must(await client.from("products").update({ ...desired, updated_at: new Date().toISOString() }).eq("id", product.id), `Update product ${product.name}`);
        Object.assign(row, desired);
        bump(counts, "products updated");
      } else bump(counts, "products unchanged");
    }

    // Remove only unreferenced objects inside this demo account's own folder (e.g. replaced demo photos).
    const referenced = new Set([...photoPaths, ...storeProducts.map((item) => item.photo_path)]);
    const orphans = [...folder].filter((name) => name.endsWith(".webp") && !referenced.has(`${account.id}/${name}`)).map((name) => `${account.id}/${name}`);
    if (orphans.length) { await removeObjects(client, orphans); bump(counts, "orphan photos removed", orphans.length); }
    log(`  ✓ ${def.key.padEnd(20)} ${def.name}`);
  }

  const byCategory = servicesByCategory(seeded);
  const rows = await loadCatalogRows(client);
  for (const entry of DEMO_PACKAGES) {
    const row = rows.get(entry.category);
    const existing = row ? validatePackageCatalog(row.catalog) : null;
    if (row && !existing) { log(`  ! Package ${entry.category}: stored catalog is not valid for the app; left untouched.`); bump(counts, "package catalogs skipped"); continue; }
    const merged = mergeDemoCatalog(entry.category, existing, entry, buildDemoSubPackages(entry, byCategory));
    if ("skip" in merged) { log(`  ! Package ${entry.category}: ${merged.skip}; left untouched.`); bump(counts, "package catalogs skipped"); continue; }
    if (existing && sameCatalog(existing, merged.catalog)) { bump(counts, "package catalogs unchanged"); continue; }
    await saveCatalog(client, entry.category, merged.catalog, row?.revision ?? 0);
    const kept = merged.catalog.sub_packages.length - entry.sub_packages.length;
    log(`  ✓ Package ${entry.category}: ${entry.sub_packages.length} demo Sub Package(s) saved${kept ? `, ${kept} existing kept` : ""}`);
    bump(counts, "package catalogs saved");
  }
  printCounts(log, "Demo seed complete:", counts);
  return counts;
}

// ---------- Shared deletion of one Staff store ----------

type StoreTarget = { serviceId: string | null; accountId: string; authUserId: string; label: string };

async function deleteStores(client: SupabaseClient, targets: StoreTarget[], counts: Counts, log: Log) {
  const serviceIds = targets.flatMap((target) => target.serviceId ? [target.serviceId] : []);
  if (serviceIds.length) {
    const productIds = (must(await client.from("products").select("id").in("service_id", serviceIds), "Read store products") as Array<{ id: string }>).map((row) => row.id);
    if (productIds.length) {
      const items = must(await client.from("customer_cart_items").delete().in("product_id", productIds).select("product_id"), "Delete cart items") as unknown[];
      bump(counts, "cart items deleted", items.length);
    }
    const carts = must(await client.from("customer_carts").delete().in("service_id", serviceIds).select("customer_account_id"), "Delete carts") as unknown[];
    bump(counts, "carts deleted", carts.length);
    const { data: orders, error: orderError } = await client.from("product_orders").delete().in("service_id", serviceIds).select("id");
    if (orderError?.code === "42501") {
      throw new Error("The service role may not delete product_orders in this project. In the Supabase SQL Editor run:\n" +
        `  delete from public.product_orders where service_id in (${serviceIds.map((id) => `'${id}'`).join(", ")});\nthen rerun this command.`);
    }
    bump(counts, "orders deleted (items cascade)", (must({ data: orders, error: orderError }, "Delete orders") as unknown[]).length);
    bump(counts, "products deleted (cascade)", productIds.length);
  }
  for (const target of targets) {
    const objects = (await listFolder(client, target.accountId)).map((name) => `${target.accountId}/${name}`);
    if (objects.length) await removeObjects(client, objects);
    bump(counts, "photos deleted", objects.length);
    const roles = must(await client.from("app_accounts").select("id,role").eq("auth_user_id", target.authUserId), `Read roles of ${target.label}`) as Array<{ id: string; role: string }>;
    if (roles.some((row) => row.role !== "staff")) {
      // The same Auth user also holds another role (e.g. Admin): remove only the Staff row.
      must(await client.from("app_accounts").delete().eq("id", target.accountId).eq("role", "staff"), `Delete Staff account of ${target.label}`);
      log(`  ✓ ${target.label}: Staff role removed; Auth user kept because it also has: ${roles.filter((row) => row.role !== "staff").map((row) => row.role).join(", ")}`);
      bump(counts, "staff rows deleted (auth kept)");
    } else {
      must(await client.auth.admin.deleteUser(target.authUserId), `Delete Auth user of ${target.label}`);
      log(`  ✓ ${target.label}: deleted`);
      bump(counts, "auth users deleted (cascade)");
    }
  }
}

async function warnCatalogReferences(client: SupabaseClient, serviceIds: string[], log: Log) {
  const rows = await loadCatalogRows(client);
  for (const [category, row] of rows) {
    const catalog = validatePackageCatalog(row.catalog);
    for (const sub of catalog?.sub_packages ?? []) {
      if (DEMO_SUB_PACKAGE_IDS.has(sub.id)) continue;
      if (sub.slots.some((slot) => slot.service_ids.some((id) => serviceIds.includes(id)))) {
        log(`  ! Package ${category} / "${sub.title}" lists a deleted store as an option; update it in /admin/packages.`);
      }
    }
  }
}

// ---------- Remove ----------

export async function removeDemo(client: SupabaseClient, log: Log = console.log) {
  const counts: Counts = {};
  const users = await listAllUsers(client);
  const targets: StoreTarget[] = [];
  for (const def of DEMO_SERVICES) {
    const user = users.get(def.email);
    if (!user) continue;
    if (!isDemoUser(user)) { log(`  ! ${def.email} exists but was not created by this script; skipped.`); bump(counts, "accounts skipped"); continue; }
    const account = must(await client.from("app_accounts").select("id").eq("role", "staff").eq("auth_user_id", user.id).maybeSingle(), `Read Staff account ${def.email}`) as { id: string } | null;
    if (!account) {
      must(await client.auth.admin.deleteUser(user.id), `Delete Auth user ${def.email}`);
      bump(counts, "auth users deleted (cascade)");
      continue;
    }
    const service = must(await client.from("services").select("id").eq("account_id", account.id).maybeSingle(), `Read Service of ${def.email}`) as { id: string } | null;
    targets.push({ serviceId: service?.id ?? null, accountId: account.id, authUserId: user.id, label: def.email });
  }

  const rows = await loadCatalogRows(client);
  for (const entry of DEMO_PACKAGES) {
    const row = rows.get(entry.category);
    const existing = row ? validatePackageCatalog(row.catalog) : null;
    if (!row || !existing) continue;
    const stripped = stripDemoCatalog(existing, entry);
    if (sameCatalog(existing, stripped)) continue;
    await saveCatalog(client, entry.category, stripped, row.revision);
    bump(counts, "demo sub packages removed", existing.sub_packages.length - stripped.sub_packages.length);
  }

  await deleteStores(client, targets, counts, log);
  if (!targets.length && !counts["auth users deleted (cascade)"]) log("  No demo accounts found.");
  printCounts(log, "Demo data removal complete:", counts);
  return counts;
}

// ---------- Delete one test store ----------

export async function deleteTestStore(client: SupabaseClient, serviceId: string, confirmed: boolean, log: Log = console.log) {
  if (!UUID.test(serviceId)) throw new Error("Pass the store's Service id (UUID).");
  const service = must(await client.from("services").select("id,name,account_id,category,latitude,longitude").eq("id", serviceId).maybeSingle(), "Read Service") as
    { id: string; name: string; account_id: string; category: string; latitude: number; longitude: number } | null;
  if (!service) throw new Error(`No Service with id ${serviceId}.`);
  const account = must(await client.from("app_accounts").select("id,role,auth_user_id").eq("id", service.account_id).maybeSingle(), "Read store account") as
    { id: string; role: string; auth_user_id: string | null } | null;
  if (!account || account.role !== "staff" || !account.auth_user_id) throw new Error("This Service is not owned by a Staff account; refusing.");
  const { data: authData, error: authError } = await client.auth.admin.getUserById(account.auth_user_id);
  if (authError || !authData.user) throw new Error("Could not read the store owner's Auth user; refusing.");
  const email = authData.user.email ?? "(no email)";
  if (isDemoUser(authData.user) || isDemoEmail(email)) throw new Error("This is a demo store; use --remove instead.");

  const products = must(await client.from("products").select("id").eq("service_id", serviceId), "Count products") as unknown[];
  const carts = must(await client.from("customer_carts").select("customer_account_id").eq("service_id", serviceId), "Count carts") as unknown[];
  const orders = must(await client.from("product_orders").select("id").eq("service_id", serviceId), "Count orders") as unknown[];
  const roles = must(await client.from("app_accounts").select("role").eq("auth_user_id", account.auth_user_id), "Read owner roles") as Array<{ role: string }>;
  const otherRoles = roles.filter((row) => row.role !== "staff").map((row) => row.role);
  log(`Store:  ${service.name}`);
  log(`Owner:  ${email}`);
  log(`Detail: category ${service.category}, coordinates ${service.latitude}, ${service.longitude}`);
  log(`Will delete: ${products.length} product(s) and their photos, ${carts.length} cart(s), ${orders.length} order(s), the store's business photos, and ` +
    (otherRoles.length ? `only the Staff role (the Auth user is kept because it also has: ${otherRoles.join(", ")}).` : "the owner's Auth user (cascades its Staff account and Service)."));
  if (!confirmed) { log("\nNothing deleted. Rerun with --yes to proceed."); return null; }
  const counts: Counts = {};
  await deleteStores(client, [{ serviceId, accountId: account.id, authUserId: account.auth_user_id, label: `${service.name} <${email}>` }], counts, log);
  await warnCatalogReferences(client, [serviceId], log);
  printCounts(log, "Test store deletion complete:", counts);
  return counts;
}

// ---------- Dry run ----------

export async function dryRun(log: Log = console.log) {
  const problems = validateCatalog();
  const files = [...new Set(DEMO_SERVICES.flatMap((service) => [...service.photos, ...service.products.map((product) => product.photo)]))];
  let sourceTotal = 0;
  let webpTotal = 0;
  for (const file of files) {
    try {
      const { size } = await stat(path.join(PHOTO_DIR, file)).catch(() => { throw new Error(`Photo file missing: scripts/demo-data/photos/${file}`); });
      if (size > MAX_SOURCE_PHOTO_BYTES) throw new Error(`Photo ${file} is larger than 5 MB`);
      const photo = await preparePhoto(file);
      sourceTotal += photo.sourceBytes; webpTotal += photo.webp.length;
    } catch (error) { problems.push(error instanceof Error ? error.message : `Photo ${file} failed`); }
  }
  const onDisk = (await readdir(PHOTO_DIR).catch(() => [] as string[])).filter((name) => name.endsWith(".jpg"));
  for (const name of onDisk) if (!files.includes(name)) log(`  note: unused photo file ${name}`);

  log("Demo seed plan (dry run, no network):");
  for (const category of DEMO_CATEGORIES) {
    log(`\n  ${category}`);
    for (const service of DEMO_SERVICES.filter((item) => item.category === category)) {
      log(`    ${service.email.padEnd(36)} ${service.name}  (${service.latitude}, ${service.longitude})`);
      for (const product of service.products) log(`      - ${product.name}  ${(product.price_satang / 100).toLocaleString("en-US")} THB`);
    }
  }
  log("\n  Packages (demo Sub Packages appended; existing ones kept)");
  for (const entry of DEMO_PACKAGES) {
    for (const sub of entry.sub_packages) {
      log(`    ${entry.category.padEnd(20)} ${sub.title}  ${(sub.price_per_person_satang / 100).toLocaleString("en-US")} THB/person, ${sub.duration_days} day(s), slots: ${sub.slots.map((slot) => slot.service_category).join(" + ")}`);
    }
  }
  const products = DEMO_SERVICES.reduce((sum, service) => sum + service.products.length, 0);
  log(`\n  Totals: ${DEMO_SERVICES.length} Staff accounts/Services, ${products} products, ${DEMO_PACKAGES.reduce((sum, entry) => sum + entry.sub_packages.length, 0)} Sub Packages, ` +
    `${files.length} photos (${(sourceTotal / 1024 / 1024).toFixed(1)} MB JPEG -> ${(webpTotal / 1024 / 1024).toFixed(1)} MB WebP)`);
  if (problems.length) { log(`\nProblems:\n  - ${problems.join("\n  - ")}`); return false; }
  log("\nCatalog OK.");
  return true;
}

// ---------- CLI ----------

const USAGE = "Usage: npm run seed-demo [-- --dry-run | --remove | --delete-test-store <serviceId> [--yes]]";

async function main() {
  const args = process.argv.slice(2);
  const known = new Set(["--dry-run", "--remove", "--delete-test-store", "--yes"]);
  const storeIndex = args.indexOf("--delete-test-store");
  const storeId = storeIndex >= 0 ? args[storeIndex + 1] : undefined;
  const unknown = args.filter((arg, index) => !known.has(arg) && !(storeIndex >= 0 && index === storeIndex + 1));
  const modes = ["--dry-run", "--remove", "--delete-test-store"].filter((mode) => args.includes(mode));
  if (unknown.length || modes.length > 1 || (storeIndex >= 0 && (!storeId || storeId.startsWith("--"))) || (args.includes("--yes") && storeIndex < 0)) throw new Error(USAGE);

  if (args.includes("--dry-run")) {
    if (!(await dryRun())) process.exitCode = 1;
    return;
  }
  try {
    process.loadEnvFile(".env.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (storeIndex >= 0) { await deleteTestStore(createServiceClient(), storeId as string, args.includes("--yes")); return; }
  if (args.includes("--remove")) { await removeDemo(createServiceClient()); return; }
  const password = process.env.DEMO_STAFF_PASSWORD ?? "";
  if (Array.from(password).length < 12 || Array.from(password).length > 72) {
    throw new Error("Set DEMO_STAFF_PASSWORD (12–72 characters) in the environment or .env.local before seeding.");
  }
  await seedDemo(createServiceClient(), password);
}

if (process.argv[1] && path.basename(process.argv[1]) === "seed-demo.ts") {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "demo seed failed.";
    console.error(`\nStopped: ${message}`);
    if (!message.startsWith("Usage:")) console.error("Completed steps are kept; rerunning the same command resumes safely.");
    process.exitCode = 1;
  });
}
