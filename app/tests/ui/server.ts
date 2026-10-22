// Isolated browser contract harness. Never imported by Next.js or the production app.
// Serves the pages, a mocked app API (/api/*) and a mocked TideCloak admin API (/admin/realms/heirloom/*)
// on one origin (127.0.0.1:3101), so no CORS is involved. Every identity and byte here is synthetic.
import { createServer, type IncomingMessage } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { demoFixtures } from "../../src/lib/fixtures";
import type { Item, PolicyEntry } from "../../src/lib/store";

type ChangeRequest = {
  id: string; actionType: string; entityType: string; entityId: string; status: "PENDING" | "APPROVED" | "DENIED";
  authorizationCount: number; threshold: number; readyToCommit: boolean; rows: { USER_ID: string; ROLE_ID: string }[];
  createdAt: number; requestedBy: string; resolvedAt?: number; resolvedBy?: string; denyReason?: string;
  authorizers?: { username: string; timestamp: number }[]; comments: { body: string; by: string }[];
};

const SEAT = "notary-duc";
const REALM = "/admin/realms/heirloom/";
const USERS: Record<string, string> = { long: "TEST-long-id" };
const ROLES: Record<string, string> = { "heir-bank-mai": "TEST-role-id", "heir-care-mai": "TEST-care-role-id" };
const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");

async function main() {
const root = process.cwd();
const double = (file: string) => () => ({ path: resolve(root, "tests/ui", file) });
const result = await build({
  // outfile (nothing is written) lets esbuild emit the CSS of imported *.module.css files as a second output.
  entryPoints: ["tests/ui/entry.tsx"], bundle: true, write: false, outfile: "bundle.js", format: "esm", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"test"' },
  plugins: [{ name: "isolated-ui-doubles", setup(bundler) {
    bundler.onResolve({ filter: /(^|\/)Session$/ }, double("session.ts"));
    bundler.onResolve({ filter: /^next\/(link|navigation)$/ }, double("navigation.tsx"));
    bundler.onResolve({ filter: /^@\/(tide-integration|lib\/tide)\/relationship$/ }, double("relationship.ts"));
    bundler.onResolve({ filter: /^@tidecloak\/nextjs$/ }, double("tidecloak.ts"));
    bundler.onResolve({ filter: /^@tideorg\/js$/ }, double("tideorg.ts"));
  } }],
});
const bundleJs = result.outputFiles.find(file => file.path.endsWith(".js"))?.text ?? "";
const moduleCss = result.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
let items: Item[] = [];
let changeRequests: ChangeRequest[] = [];
let crCounter = 0;
const policies: Record<string, PolicyEntry> = {};
for (const fixture of demoFixtures) for (const access of ["owner", "heir"]) {
  const id = `${access}:${fixture.recordId}`;
  policies[id] = { recordId: fixture.recordId, subject: { type: "Role", id: access === "owner" ? "vault-owner-mai" : fixture.recordId === "mai-care" ? "heir-care-mai" : "heir-bank-mai" }, access: access === "owner" ? "read-write" : "read", policy: id };
}
function reset(empty = false) {
  items = empty ? [] : demoFixtures.map((fixture, index) => ({ id: `fixture-${index}`, recordId: fixture.recordId, title: fixture.title, recipientUsername: fixture.recipientUsername, ownerUsername: "mai", ciphertext: `TEST-ONLY-CIPHERTEXT-${fixture.recordId}`, createdAt: "2026-10-22T00:00:00Z" }));
  changeRequests = []; crCounter = 0;
}
reset();
async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = ""; for await (const chunk of req) raw += chunk;
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:3101");
  const method = req.method ?? "GET";
  const persona = String(req.headers["x-ui-test-session"] ?? "");
  res.setHeader("Cache-Control", "no-store");
  const json = (body: unknown, status = 200) => { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
  const empty = (status: number) => { res.statusCode = status; res.end(); };
  if (url.pathname === "/__test/reset") { reset(url.searchParams.has("empty")); return json({ ok: true }); }
  if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(bundleJs); }
  // globals.css first, then the CSS-module output, the same order Next.js loads them in.
  if (url.pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(readFileSync(resolve(root, "src/app/globals.css"), "utf8") + "\n" + moduleCss); }

  if (url.pathname.startsWith("/api/")) {
    if (!persona) return json({ error: { code: "UNAUTHENTICATED", message: "UI test: no session proof" } }, 401);
    if (url.pathname === "/api/policies" && method === "POST") {
      if (persona !== SEAT) return json({ error: { code: "FORBIDDEN", message: "UI test: not a seat" } }, 403);
      const body = await readJson(req) as { policyId?: string } | undefined;
      return json({ ok: true, policyId: body?.policyId ?? null }, 201);
    }
    if (url.pathname === "/api/policies") { const record = url.searchParams.get("record"); return json({ owner: `owner:${record}`, heir: `heir:${record}` }); }
    // The real route answers 501 when the server cannot fetch the admin policy; /setup then asks TideCloak directly.
    if (url.pathname === "/api/admin-policy") return json({ error: { code: "NOT_IMPLEMENTED", message: "UI test: fetch the admin policy from TideCloak in the browser" } }, 501);
    if (url.pathname === "/api/operator/store") return json({ files: { "items.json": items, "policies.json": policies }, demoIds: { long: USERS.long, "heir-bank-mai": ROLES["heir-bank-mai"] } });
    if (url.pathname === "/api/items" && method === "POST") {
      const body = await readJson(req) as Record<string, unknown> | undefined;
      if (!body || body.content || !String(body.ciphertext).startsWith("TEST-ONLY-CIPHERTEXT-")) return json({ error: { code: "VALIDATION", message: "Expected test ciphertext only" } }, 422);
      const item = { ...body, id: `item-${items.length}`, ownerUsername: "mai", createdAt: "2026-10-22T00:00:00Z" } as Item; items.push(item); return json({ item }, 201);
    }
    if (url.pathname === "/api/items") return json({ items });
    return json({ error: { code: "NOT_FOUND", message: "Unknown test route" } }, 404);
  }

  // Mocked TideCloak admin API. Only the seat's token passes, like tide-realm-admin on the real realm.
  if (url.pathname.startsWith("/admin/")) {
    if (persona !== SEAT) return json({ error: "UI test: not a seat" }, 403);
    if (!url.pathname.startsWith(REALM)) return json({ error: "UI test: unknown realm" }, 404);
    const path = url.pathname.slice(REALM.length).split("/").map(decodeURIComponent);
    if (path[0] === "users" && path.length === 1 && method === "GET") {
      const username = url.searchParams.get("username") ?? "";
      return json(USERS[username] ? [{ id: USERS[username], username }] : []);
    }
    if (path[0] === "roles" && path.length === 2 && method === "GET") {
      return ROLES[path[1]] ? json({ id: ROLES[path[1]], name: path[1] }) : json({ error: "Could not find role" }, 404);
    }
    if (path[0] === "users" && path[2] === "role-mappings" && path[3] === "realm" && path.length === 4 && method === "POST") {
      const userId = path[1];
      if (!Object.values(USERS).includes(userId)) return json({ error: "User not found" }, 404);
      const body = await readJson(req);
      const roleIds = Array.isArray(body) ? body.map(role => String((role as { id?: unknown }).id ?? "")) : [];
      if (!roleIds.length || roleIds.some(id => !Object.values(ROLES).includes(id))) return json({ error: "Role not found" }, 404);
      const conflict = changeRequests.find(c => c.status === "PENDING" && c.entityId === userId && c.rows.some(row => roleIds.includes(row.ROLE_ID)));
      if (conflict) return json({ error: "PENDING_CHANGE_REQUEST_CONFLICT", conflictingChangeRequestId: conflict.id }, 409);
      const id = `cr-${++crCounter}`;
      changeRequests.push({ id, actionType: "GRANT_ROLES", entityType: "USER", entityId: userId, status: "PENDING", authorizationCount: 0, threshold: 1, readyToCommit: false, rows: roleIds.map(ROLE_ID => ({ USER_ID: userId, ROLE_ID })), createdAt: Date.now(), requestedBy: persona, comments: [] });
      return json({ status: "PENDING", changeRequestId: id, actionType: "GRANT_ROLES" }, 202);
    }
    if (path[0] === "iga" && path[1] === "change-requests" && path.length === 2 && method === "GET") {
      const status = url.searchParams.get("status");
      return json(changeRequests.filter(c => !status || c.status === status).map(({ comments: _comments, ...c }) => c));
    }
    if (path[0] === "iga" && path[1] === "change-requests" && path.length === 4 && method === "POST") {
      const cr = changeRequests.find(c => c.id === path[2]);
      if (!cr) return json({ error: "Change request not found" }, 404);
      const body = (await readJson(req) ?? {}) as { requestModel?: unknown; reason?: unknown; body?: unknown };
      if (path[3] === "comments") { cr.comments.push({ body: String(body.body ?? ""), by: persona }); return json({ ok: true }, 201); }
      if (cr.status !== "PENDING") return json({ error: `Change request is ${cr.status}` }, 409);
      if (path[3] === "deny") {
        Object.assign(cr, { status: "DENIED", resolvedAt: Date.now(), resolvedBy: persona, denyReason: String(body.reason ?? "") });
        return empty(204);
      }
      if (path[3] === "approve") {
        if (body.requestModel === undefined) return json({ mode: "needs-approval", changeRequestId: cr.id, requestModel: b64(`TEST-REQUEST-${cr.id}`) });
        if (body.requestModel !== b64(`TEST-REQUEST-${cr.id}`)) return json({ error: "UI test: requestModel was not the one handed out in phase 1" }, 400);
        Object.assign(cr, { status: "APPROVED", authorizationCount: 1, readyToCommit: true, resolvedAt: Date.now(), resolvedBy: persona, authorizers: [{ username: persona, timestamp: Date.now() }] });
        return json({ mode: "recorded", committed: true, status: "APPROVED", authCount: 1, threshold: 1 });
      }
    }
    if (path.join("/") === "iga/role-policies/name/tide-realm-admin" && method === "GET") return json({ policy: b64("TEST-ADMIN-POLICY") });
    return json({ error: "UI test: unknown admin route" }, 404);
  }

  res.setHeader("Content-Type", "text/html");
  res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Heirloom UI test harness</title><link rel="stylesheet" href="/style.css"><body><div style="padding:8px;background:#FFF1D6;color:#8A4B00;text-align:center;font:14px sans-serif">UI TEST HARNESS · Synthetic identities and crypto doubles · No Tide network</div><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
});
server.listen(3101, "127.0.0.1", () => process.stdout.write("Isolated UI harness: http://127.0.0.1:3101\n"));
}
main().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
