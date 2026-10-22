// Shared locators and harness calls for the UI specs. Locators use roles and loose regexes so
// restyled copy keeps matching; exact strings are only the ones the harness itself controls.
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const BANK = /bank and pension/i;
export const CARE = /care wishes/i;
export const SEAT_HEADERS = { "X-UI-Test-Session": "notary-duc" };
export const PLAINTEXT_MARKERS = ["DEMO-not-real-7", "VietBank", "dialysis"];
export const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");

/** The item card whose heading matches `title` (vault, heir and operator pages all render ItemCard). */
export function itemCard(page: Page, title: RegExp) {
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
}

export async function openCard(page: Page, title: RegExp) {
  const card = itemCard(page, title);
  await card.getByRole("button", { name: /open/i }).first().click();
  return card;
}

/** Mai seals both demo items on /vault. Returns the JSON bodies POSTed to /api/items. */
export async function sealDemoItems(page: Page) {
  const posted: Record<string, unknown>[] = [];
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/items") posted.push(request.postDataJSON()); });
  await page.goto("/vault?as=mai");
  await page.getByRole("button", { name: /seal demo items/i }).click();
  await expect(itemCard(page, CARE)).toBeVisible();
  await expect(itemCard(page, BANK)).toBeVisible();
  await expect.poll(() => posted.length).toBe(2);
  return posted;
}

export async function changeRequests(request: APIRequestContext, status: "PENDING" | "APPROVED" | "DENIED") {
  const response = await request.get(`/admin/realms/heirloom/iga/change-requests?status=${status}`, { headers: SEAT_HEADERS });
  expect(response.status()).toBe(200);
  return await response.json() as { id: string; entityId: string; status: string; rows: { USER_ID: string; ROLE_ID: string }[] }[];
}
