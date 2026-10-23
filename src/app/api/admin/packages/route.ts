import { hasValidSameOrigin, validJsonPost } from "../../../../lib/auth";
import { getAdminPackageData, isPackageCategory, PackageCatalogConflictError, PackageCatalogInputError, PackageRequestTooLargeError, readBoundedPackageJson, savePackageCatalog, validatePackageCatalog } from "../../../../lib/packages";
import { requireAdmin } from "../../../../lib/staff";

export const runtime = "nodejs";

function response(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return response(403, { error: "ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ใช้งานได้" });
  try { return response(200, await getAdminPackageData()); }
  catch { return response(503, { error: "โหลดข้อมูลแพ็กเกจไม่สำเร็จ" }); }
}

export async function POST(request: Request) {
  if (!hasValidSameOrigin(request) || !validJsonPost(request)) return response(403, { error: "คำขอไม่ถูกต้อง" });
  if (!(await requireAdmin(request))) return response(403, { error: "ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ใช้งานได้" });
  let body: unknown;
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 128_000)) return response(contentLength && /^\d+$/.test(contentLength) ? 413 : 400, { error: "ข้อมูลแพ็กเกจไม่ถูกต้องหรือมีขนาดใหญ่เกินไป" });
  try { body = await readBoundedPackageJson(request, 128_000); }
  catch (error) { return response(error instanceof PackageRequestTooLargeError ? 413 : 400, { error: error instanceof PackageRequestTooLargeError ? "ข้อมูลแพ็กเกจมีขนาดใหญ่เกินไป" : "ข้อมูลไม่ถูกต้อง" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return response(400, { error: "ข้อมูลไม่ถูกต้อง" });
  const input = body as { category?: unknown; catalog?: unknown; revision?: unknown };
  if (!isPackageCategory(input.category) || !Number.isSafeInteger(input.revision) || Number(input.revision) < 0) return response(400, { error: "ประเภทแพ็กเกจหรือ revision ไม่ถูกต้อง" });
  const catalog = validatePackageCatalog(input.catalog);
  if (!catalog) return response(400, { error: "กรุณาตรวจสอบชื่อ รายละเอียด ราคา slot และตัวเลือกบริการ" });
  try {
    const revision = await savePackageCatalog(input.category, catalog, Number(input.revision));
    return response(200, { revision, message: "บันทึกแพ็กเกจแล้ว" });
  } catch (error) {
    return response(error instanceof PackageCatalogConflictError ? 409 : error instanceof PackageCatalogInputError ? 400 : 503, { error: error instanceof Error ? error.message : "บันทึกแพ็กเกจไม่สำเร็จ" });
  }
}
