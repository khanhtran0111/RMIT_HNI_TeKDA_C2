import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test.beforeEach(async ({ request }) => { await request.post("/__test/reset"); });
test("production app renders the honest setup state on every Dev B route at four widths", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/vault", "/heir", "/operator"]) {
      await page.goto(`http://127.0.0.1:3000${route}`);
      await expect(page.getByRole("heading", { name: "Waiting for vault setup" })).toBeVisible();
      await expect(page.getByText("SYNTHETIC DATA", { exact: false }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    }
    await page.goto("http://127.0.0.1:3000/");
    await page.screenshot({ path: info.outputPath(`production-home-${width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});
test("production health is public and item/operator data require authentication", async ({ request }) => {
  expect(await (await request.get("http://127.0.0.1:3000/api/health")).json()).toEqual({ ok: true });
  for (const path of ["/api/items", "/api/operator/store"]) {
    const response = await request.get(`http://127.0.0.1:3000${path}`);
    expect(response.status()).toBe(401); expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  }
});
test("production DPoP relay serves the SDK asset byte-for-byte with enclave headers", async ({ request }) => {
  const response = await request.get("http://127.0.0.1:3000/tide_dpop/byte-check");
  expect(response.status()).toBe(200);
  const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  expect(digest(await response.body())).toBe(digest(readFileSync("node_modules/@tidecloak/js/tide_dpop_auth.html")));
  expect(response.headers()["allow-csp-from"]).toBe("*");
  expect(response.headers()["content-security-policy"]).toContain("script-src 'unsafe-inline'");
});
test("owner seals both fixtures without posting plaintext and opens/hides one", async ({ page, request }, info) => {
  await request.post("/__test/reset?empty=1");
  const posted: object[] = [];
  page.on("request", request => { if (request.method() === "POST" && request.url().endsWith("/api/items")) posted.push(request.postDataJSON()); });
  await page.goto("/vault?as=mai");
  await page.getByRole("button", { name: "Seal demo items", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Care wishes", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bank and pension logins", exact: true })).toBeVisible();
  expect(posted).toHaveLength(2);
  for (const body of posted) { expect(Object.keys(body).sort()).toEqual(["ciphertext", "recipientUsername", "recordId", "title"]); expect(JSON.stringify(body)).not.toContain("DEMO-not-real-7"); }
  await expect(page.getByRole("button", { name: "Demo items sealed", exact: true })).toBeDisabled();
  await page.getByRole("article").first().getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Opened in your browser", exact: false })).toBeVisible();
  await expect(page.getByRole("article").first().locator(".status-chip")).toContainText("SEALED");
  await page.getByRole("button", { name: "Hide plaintext", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Opened in your browser", exact: false })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("vault-1440.png"), fullPage: true });
});
test("seal form validates and clears plaintext after storing an item", async ({ page, request }) => {
  await request.post("/__test/reset?empty=1"); await page.goto("/vault?as=mai");
  await expect(page.getByRole("button", { name: "Seal for linh", exact: true })).toBeDisabled();
  await page.getByLabel("Title", { exact: true }).fill("Synthetic note");
  await page.getByLabel("Recipient", { exact: true }).selectOption("long");
  await page.getByLabel("Content", { exact: true }).fill("A browser-only synthetic note");
  await page.getByRole("button", { name: "Seal for long", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Synthetic note", exact: true })).toBeVisible();
  await expect(page.getByLabel("Content", { exact: true })).toHaveValue("");
});
test("sealed heir item shows raw refusal and sign-in hint with keyboard disclosure", async ({ page }, info) => {
  await page.goto("/heir?as=long");
  await page.getByRole("article").first().getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByText("0 of 14 nodes would release this key", { exact: true })).toBeVisible();
  await expect(page.getByText("'heir-bank-mai' role not found in doken.", { exact: true })).toBeVisible();
  const disclosure = page.getByText("Show raw error", { exact: true }); await disclosure.focus(); await page.keyboard.press("Enter");
  await expect(page.locator("details[open]")).toBeVisible();
  await expect(page.getByText("Roles arrive on your next sign-in.", { exact: false }).first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath("heir-refusal-390.png"), fullPage: true });
});
test("released bank item opens beside ciphertext while care wishes remain refused", async ({ page }, info) => {
  await page.goto("/heir?as=long&released=1");
  await expect(page.getByRole("article").first().getByText(/RELEASED TO ME/)).toBeVisible();
  await page.getByRole("article").first().getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByText("VietBank demo account", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Compare with stored ciphertext", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What Heirloom stores", exact: true })).toBeVisible();
  await page.getByRole("article").last().getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByText("'heir-care-mai' role not found in doken.", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("heir-proof-1440.png"), fullPage: true });
});
test("operator shows real UI paths for refused open, refused grant and app API refusal", async ({ page }, info) => {
  await page.goto("/operator?as=ops");
  await page.getByRole("button", { name: "Try to open", exact: true }).first().click();
  await expect(page.getByText("0 of 14 nodes would release this key", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try to release to Long", exact: true }).click();
  await expect(page.getByRole("heading", { name: "403 from TideCloak: not a seat", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Call our API without DPoP", exact: true }).click();
  await expect(page.getByText("401: the app's own API refused (not Tide)", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "items.json", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "policies.json", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "RelationshipAttestation:1", exact: true })).toHaveCount(4);
  await page.screenshot({ path: info.outputPath("operator-1440.png"), fullPage: true });
});
test("home exposes only role-appropriate links and page gates reject another identity", async ({ page }) => {
  await page.goto("/?as=long"); await expect(page.getByRole("link", { name: "From Mai, for you", exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Operator view", exact: true })).toHaveCount(0);
  await page.goto("/vault?as=long"); await expect(page.getByRole("heading", { name: "This page belongs to another role", exact: true })).toBeVisible();
  await page.goto("/?as=notary-duc"); await expect(page.getByText("Client role: realm-management / tide-realm-admin", { exact: true })).toBeVisible();
});
