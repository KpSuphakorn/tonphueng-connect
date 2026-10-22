import { hasValidSameOrigin } from "../../../lib/auth";
import { createServiceClient } from "../../../lib/supabase";
import { getSavedServices, requireCustomer, validServiceId } from "../../../lib/services";

export const runtime = "nodejs";

function response(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function GET(request: Request) {
  const account = await requireCustomer(request);
  if (!account) return response(403, { error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้า" });
  try {
    return response(200, { services: await getSavedServices(account.id) });
  } catch {
    return response(503, { error: "โหลด My Trip ไม่สำเร็จ กรุณาลองใหม่" });
  }
}

export async function POST(request: Request) {
  return changeSavedService(request, "insert");
}

export async function DELETE(request: Request) {
  return changeSavedService(request, "delete");
}

async function changeSavedService(request: Request, operation: "insert" | "delete") {
  if (!hasValidSameOrigin(request) || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return response(403, { error: "คำขอไม่ถูกต้อง" });
  }
  const account = await requireCustomer(request);
  if (!account) return response(403, { error: "กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้า" });
  let body: unknown;
  try { body = await request.json(); } catch { return response(400, { error: "ข้อมูลไม่ถูกต้อง" }); }
  const serviceId = body && typeof body === "object" ? (body as { service_id?: unknown }).service_id : undefined;
  if (!validServiceId(serviceId)) return response(400, { error: "ไม่พบบริการที่เลือก" });
  try {
    const client = createServiceClient();
    if (operation === "insert") {
      const { data: service, error: serviceError } = await client.from("services").select("id,account_id").eq("id", serviceId).maybeSingle();
      if (serviceError) throw serviceError;
      if (!service) return response(404, { error: "ไม่พบบริการที่เลือก" });
      const { data: owner, error: ownerError } = await client.from("app_accounts").select("id")
        .eq("id", service.account_id).eq("role", "staff").eq("status", "active").maybeSingle();
      if (ownerError) throw ownerError;
      if (!owner) return response(404, { error: "ไม่พบบริการที่เลือก" });
      const { error } = await client.from("my_trip_saved_services").upsert({ customer_account_id: account.id, service_id: serviceId }, { onConflict: "customer_account_id,service_id", ignoreDuplicates: true });
      if (error) throw error;
    } else {
      const { error } = await client.from("my_trip_saved_services").delete()
        .eq("customer_account_id", account.id).eq("service_id", serviceId);
      if (error) throw error;
    }
    return response(200, { message: operation === "insert" ? "บันทึกเข้า My Trip แล้ว" : "นำออกจาก My Trip แล้ว" });
  } catch {
    return response(503, { error: "บันทึกรายการไม่สำเร็จ กรุณาลองใหม่" });
  }
}
