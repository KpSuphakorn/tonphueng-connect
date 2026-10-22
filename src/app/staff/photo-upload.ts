"use client";

export async function uploadStaffPhotosDirectly(files: File[], flow: "registration" | "profile") {
  if (!files.length) return null;
  const prepared = await fetch("/api/staff/photo-uploads", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flow, count: files.length }),
  });
  const result = await prepared.json() as { error?: string; session?: string; uploads?: Array<{ path: string; signedUrl: string }> };
  if (!prepared.ok || !result.session || result.uploads?.length !== files.length) throw new Error(result.error || "เตรียมอัปโหลดรูปไม่สำเร็จ");
  for (const [index, file] of files.entries()) {
    const target = result.uploads[index];
    if (!target.path || !target.signedUrl) throw new Error("เตรียมอัปโหลดรูปไม่สำเร็จ");
    const uploaded = await fetch(target.signedUrl, {
      method: "PUT",
      credentials: "omit",
      cache: "no-store",
      headers: { "content-type": "application/octet-stream" },
      body: file,
    });
    if (!uploaded.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
  }
  return result.session;
}
