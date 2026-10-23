import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/manual/route";

afterEach(() => vi.unstubAllGlobals());

describe("GET /manual", () => {
  it("streams the static manual PDF from the same origin as a download", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.4 test");
    const fetchMock = vi.fn(async () => new Response(pdf, { headers: { "content-type": "application/pdf", "content-length": String(pdf.byteLength) } }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(new Request("https://tonphueng-connect.vercel.app/manual"));

    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("https://tonphueng-connect.vercel.app/downloads/tonphueng-connect-manual.pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain('attachment; filename="tonphueng-connect-manual.pdf"');
    expect(res.headers.get("content-disposition")).toContain(`filename*=UTF-8''${encodeURIComponent("คู่มือผึ้งพาเดิน.pdf")}`);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-length")).toBe(String(pdf.byteLength));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(pdf);
  });

  it("returns plain-text 404 when the static file is missing or unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>not found</html>", { status: 404 })));
    const missing = await GET(new Request("http://localhost:3000/manual"));
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(missing.headers.get("cache-control")).toBe("no-store");
    expect(await missing.text()).toBe("Manual not found");

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network down"); }));
    const offline = await GET(new Request("http://localhost:3000/manual"));
    expect(offline.status).toBe(404);
  });
});
