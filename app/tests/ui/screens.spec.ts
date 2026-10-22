// Full-page 1920x1080 screenshots of every demo screen, for review and the video storyboard.
// Each test sets up its own state and writes its file in `finally`, so one failing screen
// never stops the others from being captured.
import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { BANK, CARE, itemCard, openCard, sealDemoItems } from "./helpers";

const SCREENS = resolve(process.cwd(), "test-results", "screens");
test.use({ viewport: { width: 1920, height: 1080 } });
test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await request.post("/__test/reset"); });

async function capture(page: Page, name: string, act: () => Promise<void>) {
  try { await act(); }
  finally {
    // Bounded waits: a slow web-font fetch must not eat the test timeout before the file is written.
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await page.screenshot({ path: resolve(SCREENS, `${name}.png`), fullPage: true, timeout: 30_000 });
  }
}

test("home-signed-out", async ({ page }) => {
  await capture(page, "home-signed-out", async () => {
    await page.goto("/?as=anonymous");
    await expect(page.getByRole("button", { name: /sign in/i }).first()).toBeVisible();
  });
});

test("home-mai", async ({ page }) => {
  await capture(page, "home-mai", async () => {
    await page.goto("/?as=mai");
    await expect(page.getByRole("link", { name: /vault/i }).first()).toBeVisible();
  });
});

test("vault-mai", async ({ page, request }) => {
  await request.post("/__test/reset?empty=1");
  await capture(page, "vault-mai", async () => { await sealDemoItems(page); });
});

test("heir-long-refused", async ({ page }) => {
  await capture(page, "heir-long-refused", async () => {
    await page.goto("/heir?as=long");
    for (const title of [BANK, CARE]) await expect((await openCard(page, title)).getByText(/refused/i).first()).toBeVisible();
  });
});

test("operator-long", async ({ page }) => {
  await capture(page, "operator-long", async () => {
    await page.goto("/operator?as=long");
    await itemCard(page, BANK).getByRole("button", { name: /try to open/i }).click();
    await expect(itemCard(page, BANK).getByText(/refused/i).first()).toBeVisible();
    await page.getByRole("button", { name: /try to release/i }).click();
    await expect(page.getByText(/not a seat/i).first()).toBeVisible();
  });
});

test("seats-notary", async ({ page }) => {
  await capture(page, "seats-notary", async () => {
    await page.goto("/seats?as=notary-duc");
    await page.getByRole("button", { name: /release bank logins/i }).click();
    await expect(page.getByRole("button", { name: /approve/i }).first()).toBeVisible();
  });
});

test("heir-long-released", async ({ page }) => {
  await capture(page, "heir-long-released", async () => {
    await page.goto("/heir?as=long&released=1");
    await expect((await openCard(page, BANK)).getByText(/VietBank/).first()).toBeVisible();
    await expect((await openCard(page, CARE)).getByText(/refused/i).first()).toBeVisible();
  });
});

test("setup-notary", async ({ page }) => {
  await capture(page, "setup-notary", async () => {
    await page.goto("/setup?as=notary-duc");
    await expect(page.getByText(/TideCloak in the browser|TEST-vendor/).first()).toBeVisible();
  });
});
