import { validJsonPost } from "../../../../lib/auth";
import { getCustomerPackageSelections, getPublicPackageData, isPackageCategory, PackageRequestTooLargeError, readBoundedPackageJson, saveCustomerPackageSelection, validateSelections } from "../../../../lib/packages";
import { requireCustomer } from "../../../../lib/services";

export const runtime = "nodejs";

function response(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function GET(request: Request) {
  const account = await requireCustomer(request);
  if (!account) return response(403, { error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้า" });
  try { return response(200, { selections: await getCustomerPackageSelections(account.id) }); }
  catch { return response(503, { error: "โหลดตัวเลือกของฉันไม่สำเร็จ" }); }
}

export async function POST(request: Request) {
  if (!validJsonPost(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  const account = await requireCustomer(request);
  if (!account) return response(403, { error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้า" });
  let body: unknown;
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 32_000)) return response(contentLength && /^\d+$/.test(contentLength) ? 413 : 400, { error: "ข้อมูลตัวเลือกไม่ถูกต้องหรือมีขนาดใหญ่เกินไป" });
  try { body = await readBoundedPackageJson(request, 32_000); }
  catch (error) { return response(error instanceof PackageRequestTooLargeError ? 413 : 400, { error: error instanceof PackageRequestTooLargeError ? "ข้อมูลตัวเลือกมีขนาดใหญ่เกินไป" : "ข้อมูลไม่ถูกต้อง" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return response(400, { error: "ข้อมูลไม่ถูกต้อง" });
  const input = body as { category?: unknown; sub_package_id?: unknown; revision?: unknown; choices?: unknown; price_per_person_satang?: unknown };
  if (Object.hasOwn(input, "price_per_person_satang")) return response(400, { error: "ราคาได้รับจากระบบเท่านั้น" });
  if (!isPackageCategory(input.category) || typeof input.sub_package_id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.sub_package_id) ||
    !Number.isSafeInteger(input.revision) || Number(input.revision) < 1) return response(400, { error: "ข้อมูลแพ็กเกจไม่ถูกต้อง" });
  const choices = validateSelections(input.choices);
  if (!choices) return response(400, { error: "ข้อมูลตัวเลือกไม่ถูกต้อง" });
  try {
    const categories = await getPublicPackageData();
    const category = categories.find((item) => item.category === input.category);
    const subPackage = category?.sub_packages.find((item) => item.id === input.sub_package_id);
    if (!category || !subPackage || category.revision !== input.revision || choices.length !== subPackage.slots.length ||
      subPackage.slots.some((slot) => {
        const choice = choices.find((item) => item.slot_id === slot.id);
        return !choice || choice.service_ids.length !== slot.required_count || choice.service_ids.some((id) => !slot.options.some((option) => option.id === id));
      })) return response(400, { error: "จำนวนหรือบริการที่เลือกไม่ตรงกับแพ็กเกจ" });
    const saved = await saveCustomerPackageSelection(account.id, input.category, input.sub_package_id, Number(input.revision), choices);
    return response(200, { selection: saved, message: "บันทึกตัวเลือกแล้ว" });
  } catch {
    return response(409, { error: "แพ็กเกจเปลี่ยนแปลงหรือไม่สามารถบันทึกได้ กรุณาโหลดหน้าใหม่" });
  }
}
