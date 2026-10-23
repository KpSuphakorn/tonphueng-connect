import { getPublicPackageData } from "../../../lib/packages";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ categories: await getPublicPackageData() }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch {
    return Response.json({ error: "โหลดแพ็กเกจไม่สำเร็จ กรุณาลองใหม่" }, { status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  }
}
