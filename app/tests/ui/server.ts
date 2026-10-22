// Isolated browser contract harness. Never imported by Next.js or the production app.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { demoFixtures } from "../../src/lib/fixtures";
import type { Item, PolicyEntry } from "../../src/lib/store";

async function main() {
const root = process.cwd();
const result = await build({
  entryPoints: ["tests/ui/entry.tsx"], bundle: true, write: false, format: "esm", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"test"' },
  plugins: [{ name: "isolated-ui-doubles", setup(bundler) {
    bundler.onResolve({ filter: /(^|\/)Session$/ }, () => ({ path: resolve(root, "tests/ui/session.ts") }));
    bundler.onResolve({ filter: /^next\/(link|navigation)$/ }, () => ({ path: resolve(root, "tests/ui/navigation.tsx") }));
    bundler.onResolve({ filter: /^@\/tide-integration\/relationship$/ }, () => ({ path: resolve(root, "tests/ui/relationship.ts") }));
  } }],
});
let items: Item[] = [];
const policies: Record<string, PolicyEntry> = {};
for (const fixture of demoFixtures) for (const access of ["owner", "heir"]) {
  const id = `${access}:${fixture.recordId}`;
  policies[id] = { recordId: fixture.recordId, subject: { type: "Role", id: access === "owner" ? "vault-owner-mai" : fixture.recordId === "mai-care" ? "heir-care-mai" : "heir-bank-mai" }, access: access === "owner" ? "read-write" : "read", policy: id };
}
function reset(empty = false) { items = empty ? [] : demoFixtures.map((fixture, index) => ({ id: `fixture-${index}`, recordId: fixture.recordId, title: fixture.title, recipientUsername: fixture.recipientUsername, ownerUsername: "mai", ciphertext: `TEST-ONLY-CIPHERTEXT-${fixture.recordId}`, createdAt: "2026-10-22T00:00:00Z" })); }
reset();
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:3101");
  res.setHeader("Cache-Control", "no-store");
  const json = (body: unknown, status = 200) => { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
  if (url.pathname === "/__test/reset") { reset(url.searchParams.has("empty")); return json({ ok: true }); }
  if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(result.outputFiles[0].text); }
  if (url.pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(readFileSync(resolve(root, "src/app/globals.css"))); }
  if (url.pathname.startsWith("/api/")) {
    if (!req.headers["x-ui-test-session"]) return json({ error: { code: "UNAUTHENTICATED", message: "UI test: no session proof" } }, 401);
    if (url.pathname === "/api/policies") { const record = url.searchParams.get("record"); return json({ owner: `owner:${record}`, heir: `heir:${record}` }); }
    if (url.pathname === "/api/operator/store") return json({ files: { "items.json": items, "policies.json": policies }, demoIds: { long: "TEST-long-id", "heir-bank-mai": "TEST-role-id" } });
    if (url.pathname === "/api/items" && req.method === "POST") {
      let raw = ""; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      if (body.content || !String(body.ciphertext).startsWith("TEST-ONLY-CIPHERTEXT-")) return json({ error: { code: "VALIDATION", message: "Expected test ciphertext only" } }, 422);
      const item = { ...body, id: `item-${items.length}`, ownerUsername: "mai", createdAt: "2026-10-22T00:00:00Z" }; items.push(item); return json({ item }, 201);
    }
    if (url.pathname === "/api/items") return json({ items });
    return json({ error: { code: "NOT_FOUND", message: "Unknown test route" } }, 404);
  }
  if (url.pathname.startsWith("/admin/")) return json({ error: "UI test: not a seat" }, 403);
  res.setHeader("Content-Type", "text/html");
  res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Heirloom UI test harness</title><link rel="stylesheet" href="/style.css"><body><div style="padding:8px;background:#FFF1D6;color:#8A4B00;text-align:center;font:14px sans-serif">UI TEST HARNESS · Synthetic identities and crypto doubles · No Tide network</div><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
});
server.listen(3101, "127.0.0.1", () => process.stdout.write("Isolated UI harness: http://127.0.0.1:3101\n"));
}
main().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
