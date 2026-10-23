import { listProductStores, listProductsForStore, isProductId } from "../../../lib/products";

export const runtime = "nodejs";

function response(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function GET(request: Request) {
  try {
    const serviceId = new URL(request.url).searchParams.get("service_id");
    if (serviceId === null) return response(200, { stores: await listProductStores() });
    if (!isProductId(serviceId)) return response(400, { error: "เลือกร้านค้าให้ถูกต้อง" });
    const products = await listProductsForStore(serviceId);
    return products ? response(200, { products }) : response(404, { error: "ไม่พบร้านสินค้าชุมชนที่เปิดใช้งาน" });
  } catch {
    return response(503, { error: "โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่" });
  }
}
