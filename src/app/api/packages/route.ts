import { getPublicPackageData } from "../../../lib/packages";

export const runtime = "nodejs";
const corsHeaders = { "access-control-allow-origin": "*" };

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...corsHeaders, "access-control-allow-methods": "GET, OPTIONS" } });
}

export async function GET() {
  try {
    return Response.json({ categories: await getPublicPackageData() }, { headers: { ...corsHeaders, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch {
    return Response.json({ error: "โหลดแพ็กเกจไม่สำเร็จ กรุณาลองใหม่" }, { status: 503, headers: { ...corsHeaders, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  }
}
