import { expect, test } from "@playwright/test";

test("login lets a person choose the matching account type", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ Tonphueng Connect" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ลูกค้า" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ผู้ประกอบการชุมชน" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ผู้ดูแลโครงการ" })).toBeVisible();

  await page.getByRole("button", { name: "ผู้ประกอบการชุมชน" }).click();
  await expect(page.getByLabel("อีเมล")).toBeVisible();
  await expect(page.getByLabel("รหัสผ่าน")).toBeVisible();
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true })).toBeVisible();
});

test("home offers open to an honest empty state", async ({ page }) => {
  await page.goto("/");
  const offer = page.locator("details.feature-card").first();
  await expect(offer).toBeVisible();
  await offer.locator("summary").click();
  await expect(offer.locator(".empty-detail")).toBeVisible();
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
