import { listServices, PAGE_SIZE, parseCoordinate, parseServiceCategory } from "../../../lib/services";

export const runtime = "nodejs";

function response(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const rawCategory = searchParams.get("category");
  const category = rawCategory === null ? null : parseServiceCategory(rawCategory);
  if (rawCategory !== null && !category) return response(400, { error: "กรุณาเลือกประเภทบริการที่ถูกต้อง" });
  const rawOffset = searchParams.get("offset") ?? "0";
  const offset = Number(rawOffset);
  const latitude = parseCoordinate(searchParams.get("latitude"), -90, 90);
  const longitude = parseCoordinate(searchParams.get("longitude"), -180, 180);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000 || Number.isNaN(latitude) || Number.isNaN(longitude) || (latitude === null) !== (longitude === null)) {
    return response(400, { error: "ตัวกรองหรือพิกัดไม่ถูกต้อง" });
  }
  try {
    const page = await listServices(category, offset, latitude, longitude);
    return response(200, { ...page, limit: PAGE_SIZE });
  } catch {
    return response(503, { error: "โหลดรายการบริการไม่สำเร็จ กรุณาลองใหม่" });
  }
}
