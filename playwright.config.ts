import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      SUPABASE_URL: "http://127.0.0.1:4174",
      SUPABASE_PUBLISHABLE_KEY: "playwright-publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: "playwright-server-only-key",
      LINE_LOGIN_CHANNEL_ID: "playwright-line-channel",
      NEXT_PUBLIC_LINE_LIFF_ID: "playwright-test-liff-id",
      APP_ORIGIN: "http://127.0.0.1:4173",
    },
  },
});
