import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui", testMatch: "*.spec.ts", workers: 1,
  timeout: 45_000,
  use: { channel: "chrome", headless: true, baseURL: "http://127.0.0.1:3101", viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure" },
  webServer: [
    { command: "npm run dev -- --hostname 127.0.0.1", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI, timeout: 90_000 },
    { command: "node --import tsx tests/ui/server.ts", url: "http://127.0.0.1:3101", reuseExistingServer: false, timeout: 30_000 },
  ],
});
