/**
 * Public short link for the user manual: GET /manual downloads the PDF.
 * The PDF lives in `public/` (served by the CDN on Vercel, not guaranteed on the
 * function filesystem), so the handler fetches it from the same origin and streams it back.
 */
const MANUAL_PATH = "/downloads/tonphueng-connect-manual.pdf";
const ASCII_NAME = "tonphueng-connect-manual.pdf";
const THAI_NAME = "คู่มือผึ้งพาเดิน.pdf";

export async function GET(request: Request) {
  const upstream = await fetch(new URL(MANUAL_PATH, request.url), { cache: "no-store" }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    await upstream?.body?.cancel();
    return new Response("Manual not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }

  const headers = new Headers({
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${ASCII_NAME}"; filename*=UTF-8''${encodeURIComponent(THAI_NAME)}`,
    "cache-control": "public, max-age=300",
    "x-content-type-options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);

  return new Response(upstream.body, { status: 200, headers });
}
