import { hasValidSameOrigin } from "../../../../lib/auth";
import { requireStaff } from "../../../../lib/staff";
import { issueStaffPhotoUploadSession, StaffPhotoUploadCleanupError, type StaffPhotoFlow } from "../../../../lib/staff-photo-uploads";

export const runtime = "nodejs";

function response(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function POST(request: Request) {
  if (!hasValidSameOrigin(request) || request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return response(403, { error: "คำขอไม่ถูกต้อง" });
  }
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > 1024) return response(413, { error: "ข้อมูลไม่ถูกต้อง" });
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024) {
          await reader.cancel();
          return response(413, { error: "ข้อมูลไม่ถูกต้อง" });
        }
        chunks.push(value);
      }
      reader.releaseLock();
    }
    body = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    return response(400, { error: "ข้อมูลไม่ถูกต้อง" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return response(400, { error: "ข้อมูลไม่ถูกต้อง" });
  const input = body as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "count,flow" || !Number.isInteger(input.count) || (input.count as number) < 1 || (input.count as number) > 19 || (input.flow !== "registration" && input.flow !== "profile")) {
    return response(400, { error: "ข้อมูลไม่ถูกต้อง" });
  }
  const flow = input.flow as StaffPhotoFlow;
  const account = flow === "profile" ? await requireStaff(request) : null;
  if (flow === "profile" && !account) return response(403, { error: "ไม่มีสิทธิ์จัดการข้อมูลผู้ประกอบการ" });
  try {
    return response(201, await issueStaffPhotoUploadSession(flow, input.count as number, account?.id ?? null));
  } catch (error) {
    if (error instanceof StaffPhotoUploadCleanupError) {
      return response(503, {
        error: `อัปโหลดไม่สำเร็จ กรุณาติดต่อผู้ดูแลโครงการพร้อมรหัสอ้างอิง ${error.sessionId}`,
        cleanup_required: true,
        reference: error.sessionId,
      });
    }
    return response(503, { error: error instanceof Error ? error.message : "เตรียมอัปโหลดไม่สำเร็จ" });
  }
}
