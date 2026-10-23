import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { generateKeyPairSync, sign } from "node:crypto";

function makeLineToken() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "ES256", kid: "playwright-key" });
  const payload = encode({ iss: "https://access.line.me", aud: "2012159405", sub: "playwright-customer", exp: Math.floor(Date.now() / 1000) + 600 });
  const content = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(content), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return { token: `${content}.${signature}`, key: { ...jwk, kid: "playwright-key", alg: "ES256", use: "sig" } };
}

async function stubLine(page: import("@playwright/test").Page, onAuthorize: "return" | "cancel-once" | "back-once" = "return", failFirstContext = false, holdContext?: { release?: () => void }) {
  const { token, key } = makeLineToken();
  const contextToken = `context.${Buffer.from(JSON.stringify({
    liffId: "2012159405-playwright-test",
    endpointUrl: "http://127.0.0.1:4173/login",
    scope: "openid",
    type: "full",
  })).toString("base64url")}.signature`;
  const lineRequests: string[] = [];
  let contextAttempts = 0;
  let authorizationAttempts = 0;
  await page.route("https://**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!url.hostname.endsWith("line.me") && !url.hostname.endsWith("line-scdn.net")) return route.abort();
    lineRequests.push(url.href);
    if (url.pathname.endsWith("/contextToken")) {
      contextAttempts += 1;
      if (failFirstContext && contextAttempts === 1) return route.fulfill({ status: 503, json: { error: "temporary test failure" } });
      if (holdContext && contextAttempts === 1) await new Promise<void>((resolve) => { holdContext.release = resolve; });
      return route.fulfill({ json: { contextToken } });
    }
    if (url.pathname.endsWith("/oauth2/v2.1/certs")) return route.fulfill({ json: { keys: [key] } });
    if (url.pathname.endsWith("/oauth2/v2.1/token")) {
      return route.fulfill({ json: { access_token: "playwright-access-token", id_token: token, expires_in: 3600 } });
    }
    if (url.pathname.endsWith("/liff/v1/authorize")) {
      authorizationAttempts += 1;
      const firstAttempt = authorizationAttempts === 1;
      const body = (onAuthorize === "cancel-once" && firstAttempt)
        ? `<script>const u=new URLSearchParams(location.search);const t=new URL(u.get("redirect_uri"));t.searchParams.set("error","access_denied");t.searchParams.set("error_description","cancelled");t.searchParams.set("liffOAuth2Error","true");t.searchParams.set("keep","yes");location.replace(t.href)</script>`
        : (onAuthorize === "back-once" && firstAttempt)
          ? `<button id="cancel">Cancel</button><script>document.querySelector("#cancel").onclick=()=>history.back()</script>`
          : `<script>const u=new URLSearchParams(location.search);const t=new URL(u.get("redirect_uri"));t.searchParams.set("code","playwright-code");t.searchParams.set("liffClientId","2012159405");location.replace(t.href)</script>`;
      return route.fulfill({ contentType: "text/html", body });
    }
    if (url.hostname.endsWith("line-scdn.net")) return route.fulfill({ contentType: "application/javascript", body: "" });
    return route.fulfill({ status: 404, json: { error: "unexpected LINE request" } });
  });
  return lineRequests;
}

test("login lets a person choose the matching account type", async ({ page }) => {
  const lineRequests = await stubLine(page);
  const screenshotDir = process.env.UI_SCREENSHOT_DIR;
  await page.goto("/login");
  if (screenshotDir) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-login-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${screenshotDir}/tonphueng-login-desktop.png`, fullPage: true });
  }

  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ Tonphueng Connect" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ลูกค้า" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ผู้ประกอบการชุมชน" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ผู้ดูแลโครงการ" })).toBeVisible();

  await page.getByRole("button", { name: "ผู้ประกอบการชุมชน" }).click();
  await expect(page.getByLabel("อีเมล")).toBeVisible();
  await expect(page.getByLabel("รหัสผ่าน")).toBeVisible();
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true })).toBeVisible();
  expect(lineRequests.some((url) => url.includes("/authorize"))).toBe(false);
  // Choosing Admin obtains the LINE identity without a separate button: outside LINE it goes through LINE login and returns preselected.
  await page.getByRole("button", { name: "ผู้ดูแลโครงการ" }).click();
  await expect(page.getByText("เชื่อม LINE แล้ว", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ผู้ดูแลโครงการ" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("อีเมล")).toBeEnabled();
  await expect(page.getByRole("button", { name: "ยืนยันบัญชี LINE ที่ผูกไว้" })).toHaveCount(0);
  expect(lineRequests.filter((url) => url.includes("/liff/v1/authorize")).length).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem("tonphueng-admin-login-intent"))).toBeNull();
});

test("a canceled Admin LINE connection shows a retry that completes without reselecting the role", async ({ page }) => {
  const lineRequests = await stubLine(page, "cancel-once");
  await page.goto("/login");
  await page.getByRole("button", { name: "ผู้ดูแลโครงการ" }).click();
  await expect(page.getByRole("button", { name: "ลองเชื่อม LINE อีกครั้ง" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ผู้ดูแลโครงการ" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "ลองเชื่อม LINE อีกครั้ง" }).click();
  await expect(page.getByText("เชื่อม LINE แล้ว", { exact: true })).toBeVisible();
  expect(lineRequests.filter((url) => url.includes("/liff/v1/authorize")).length).toBe(2);
});

test("Customer choice resumes after LINE callback and submits once without choosing again", async ({ page }) => {
  const lineRequests = await stubLine(page);
  let customerPosts = 0;
  await page.route("**/api/auth/line", async (route) => {
    customerPosts += 1;
    await route.fulfill({ json: { redirectTo: "/" } });
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "ลูกค้า" }).click();
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => customerPosts).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem("tonphueng-login-intent"))).toBeNull();

  await page.goto("/login");
  const authorizationsBeforeSignedInVisit = lineRequests.filter((url) => url.includes("/liff/v1/authorize")).length;
  await page.getByRole("button", { name: "ลูกค้า" }).click();
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => customerPosts).toBe(2);
  expect(lineRequests.filter((url) => url.includes("/liff/v1/authorize")).length).toBe(authorizationsBeforeSignedInVisit);
});

test("a failed LIFF init can be retried after the Customer explicitly continues", async ({ page }) => {
  const lineRequests = await stubLine(page, "return", true);
  await page.route("**/api/auth/line", (route) => route.fulfill({ json: { redirectTo: "/" } }));
  await page.goto("/login");
  await expect.poll(() => lineRequests.filter((url) => url.includes("/contextToken")).length).toBe(1);
  await page.getByRole("button", { name: "ลูกค้า" }).click();
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(lineRequests.filter((url) => url.includes("/contextToken")).length).toBeGreaterThanOrEqual(2);
});

test("initial visit does not force LINE login; a canceled callback can be retried without role reselection", async ({ page }) => {
  const lineRequests = await stubLine(page, "cancel-once");
  let customerPosts = 0;
  await page.route("**/api/auth/line", async (route) => {
    customerPosts += 1;
    await route.fulfill({ json: { redirectTo: "/" } });
  });
  await page.goto("/login");
  await expect.poll(() => lineRequests.some((url) => url.includes("/contextToken"))).toBe(true);
  expect(lineRequests.some((url) => url.includes("/authorize"))).toBe(false);
  await expect(page.getByRole("button", { name: "ลูกค้า" })).toBeVisible();
  await page.getByRole("button", { name: "ลูกค้า" }).click();
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).click();
  await expect(page.getByRole("button", { name: "ดำเนินการด้วย LINE" })).toBeVisible();
  await expect(page.getByText(/ยังไม่ได้เข้าสู่ระบบ LINE|เชื่อมต่อ LINE ไม่สำเร็จ/)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("tonphueng-login-intent"))).toBeNull();
  expect(await page.evaluate(() => location.search)).toBe("?keep=yes");
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => customerPosts).toBe(1);
  expect(lineRequests.filter((url) => url.includes("/liff/v1/authorize")).length).toBe(2);
});

test("Back from external LINE login clears the pending intent and unlocks explicit retry", async ({ page }) => {
  const lineRequests = await stubLine(page, "back-once");
  let customerPosts = 0;
  await page.route("**/api/auth/line", async (route) => {
    customerPosts += 1;
    await route.fulfill({ json: { redirectTo: "/" } });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "ลูกค้า" }).click();
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).click();
  await expect(page).toHaveURL(/access\.line\.me\/liff\/v1\/authorize/);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:4173\/login/);
  await expect(page.getByRole("button", { name: "ดำเนินการด้วย LINE" })).toBeEnabled();
  await expect(page.getByText(/การเข้าสู่ระบบ LINE ถูกยกเลิก|ยังไม่ได้เข้าสู่ระบบ LINE/)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("tonphueng-login-intent"))).toBeNull();
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => customerPosts).toBe(1);
  expect(lineRequests.filter((url) => url.includes("/liff/v1/authorize")).length).toBe(2);
});

test("a persisted pageshow cancels a pending Customer request without starting LINE login", async ({ page }) => {
  const holdContext: { release?: () => void } = {};
  const lineRequests = await stubLine(page, "return", false, holdContext);
  let customerPosts = 0;
  await page.route("**/api/auth/line", async (route) => {
    customerPosts += 1;
    await route.fulfill({ json: { redirectTo: "/" } });
  });
  await page.goto("/login");
  await expect.poll(() => Boolean(holdContext.release)).toBe(true);
  await page.getByRole("button", { name: "ลูกค้า" }).click();
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).click();
  await expect(page.getByRole("button", { name: /กำลังเชื่อมต่อ LINE/ })).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  expect(await page.evaluate(() => sessionStorage.getItem("tonphueng-login-intent"))).toBeNull();
  await expect(page.getByRole("button", { name: "ดำเนินการด้วย LINE" })).toBeEnabled();
  await expect.poll(() => lineRequests.some((url) => url.includes("/liff/v1/authorize"))).toBe(false);
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).click();
  await expect(page.getByRole("button", { name: /กำลังเชื่อมต่อ LINE/ })).toBeDisabled();
  holdContext.release?.();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => customerPosts).toBe(1);
  expect(lineRequests.filter((url) => url.includes("/liff/v1/authorize")).length).toBe(1);
});

test("an expired Customer intent unlocks the form after pending LIFF initialization", async ({ page }) => {
  const holdContext: { release?: () => void } = {};
  const lineRequests = await stubLine(page, "return", false, holdContext);
  await page.goto("/login");
  await expect.poll(() => Boolean(holdContext.release)).toBe(true);
  await page.getByRole("button", { name: "ลูกค้า" }).click();
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).click();
  await page.evaluate(() => sessionStorage.removeItem("tonphueng-login-intent"));
  holdContext.release?.();
  await expect(page.getByRole("button", { name: "ดำเนินการด้วย LINE" })).toBeEnabled();
  await expect(page.getByText(/หมดอายุ/)).toBeVisible();
  expect(lineRequests.some((url) => url.includes("/liff/v1/authorize"))).toBe(false);
});

test("a stale LINE auth response cannot navigate after the Customer attempt was canceled", async ({ page }) => {
  await stubLine(page);
  let releaseAuthResponse: (() => void) | undefined;
  await page.route("**/api/auth/line", async (route) => {
    await new Promise<void>((resolve) => { releaseAuthResponse = resolve; });
    await route.fulfill({ json: { redirectTo: "/" } });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "ลูกค้า" }).click();
  await page.getByRole("button", { name: "ดำเนินการด้วย LINE" }).click();
  await expect.poll(() => Boolean(releaseAuthResponse)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  const authResponse = page.waitForResponse((response) => response.url().includes("/api/auth/line"));
  releaseAuthResponse?.();
  await (await authResponse).finished();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole("button", { name: "ดำเนินการด้วย LINE" })).toBeEnabled();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => sessionStorage.getItem("tonphueng-login-intent"))).toBeNull();
});

test("home's Product offer opens the empty community-store list", async ({ page }) => {
  const screenshotDir = process.env.UI_SCREENSHOT_DIR;
  const supabase = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("[]");
  });
  await new Promise<void>((resolve) => supabase.listen(4174, "127.0.0.1", resolve));
  try {
    await page.goto("/");
    if (screenshotDir) {
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${screenshotDir}/tonphueng-home-mobile.png` });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: `${screenshotDir}/tonphueng-home-desktop.png` });
    }
    await page.getByRole("link", { name: /สินค้าชุมชน/ }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole("heading", { name: "เลือกร้านสินค้าชุมชน" })).toBeVisible();
    await expect(page.getByText("ยังไม่มีร้านสินค้าชุมชนที่เปิดใช้งาน")).toBeVisible();
  } finally {
    await new Promise<void>((resolve, reject) => supabase.close((error) => error ? reject(error) : resolve()));
  }
});

test("protected Staff and Admin pages deny a tampered session cookie", async ({ page }) => {
  await page.context().addCookies([
    { name: "tonphueng_session", value: "tampered-cookie", url: "http://127.0.0.1:4173" },
  ]);

  await page.goto("/staff");
  await expect(page.getByText("บัญชีนี้ยังไม่มีสิทธิ์ Staff ที่อนุมัติแล้ว กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับอนุมัติ")).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByText("กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่เจ้าของโครงการตั้งค่าไว้")).toBeVisible();
});
