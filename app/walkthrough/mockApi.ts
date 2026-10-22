// Public walkthrough: the Heirloom API and the TideCloak admin API, simulated in the browser.
// Same routes, status codes and rules as tests/ui/server.ts (which mirrors the real routes):
// only a seat may call the admin API, a role grant files a change request, approval is two-phase.
import { demoFixtures } from "../src/lib/fixtures";
import type { Item, PolicyEntry } from "../src/lib/store";
import { load, ROLES, save, SEAT, USERS, type State } from "./state";

const REALM = "/admin/realms/heirloom/";
const b64 = (text: string) => btoa(text);
const policies: Record<string, PolicyEntry> = {};
for (const fixture of demoFixtures) for (const access of ["owner", "heir"]) {
  const id = `${access}:${fixture.recordId}`;
  policies[id] = { recordId: fixture.recordId, subject: { type: "Role", id: access === "owner" ? "vault-owner-mai" : fixture.recordId === "mai-care" ? "heir-care-mai" : "heir-bank-mai" }, access: access === "owner" ? "read-write" : "read", policy: id };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const empty = (status: number) => new Response(null, { status });
const parse = (raw: string | null): unknown => { if (!raw) return undefined; try { return JSON.parse(raw); } catch { return undefined; } };

function handle(state: State, method: string, url: URL, persona: string, raw: string | null): Response {
  if (url.pathname.startsWith("/api/")) {
    if (!persona || persona === "anonymous") return json({ error: { code: "UNAUTHENTICATED", message: "Sign in first" } }, 401);
    if (url.pathname === "/api/policies" && method === "POST") {
      if (persona !== SEAT) return json({ error: { code: "FORBIDDEN", message: "Not a seat" } }, 403);
      const body = parse(raw) as { policyId?: string } | undefined;
      return json({ ok: true, policyId: body?.policyId ?? null }, 201);
    }
    if (url.pathname === "/api/policies") { const record = url.searchParams.get("record"); return json({ owner: `owner:${record}`, heir: `heir:${record}` }); }
    if (url.pathname === "/api/admin-policy") return json({ error: { code: "NOT_IMPLEMENTED", message: "Fetch the admin policy from TideCloak in the browser" } }, 501);
    if (url.pathname === "/api/operator/store") return json({ files: { "items.json": state.items, "policies.json": policies }, demoIds: { long: USERS.long, "heir-bank-mai": ROLES["heir-bank-mai"] } });
    if (url.pathname === "/api/items" && method === "POST") {
      if (persona !== "mai") return json({ error: { code: "FORBIDDEN", message: "Only the vault owner can seal items" } }, 403);
      const body = parse(raw) as Record<string, unknown> | undefined;
      if (!body || body.content || typeof body.ciphertext !== "string") return json({ error: { code: "VALIDATION", message: "Expected ciphertext only" } }, 422);
      const item = { ...body, id: `item-${state.items.length + 1}`, ownerUsername: "mai", createdAt: new Date().toISOString() } as Item;
      state.items.push(item); return json({ item }, 201);
    }
    if (url.pathname === "/api/items") return json({ items: state.items });
    return json({ error: { code: "NOT_FOUND", message: "Unknown route" } }, 404);
  }

  if (persona !== SEAT) return json({ error: "HTTP 403 Forbidden: not a seat" }, 403);
  if (!url.pathname.startsWith(REALM)) return json({ error: "Unknown realm" }, 404);
  const path = url.pathname.slice(REALM.length).split("/").map(decodeURIComponent);
  const crs = state.changeRequests;
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
    const body = parse(raw);
    const roleIds = Array.isArray(body) ? body.map(role => String((role as { id?: unknown }).id ?? "")) : [];
    if (!roleIds.length || roleIds.some(id => !Object.values(ROLES).includes(id))) return json({ error: "Role not found" }, 404);
    const conflict = crs.find(c => c.status === "PENDING" && c.entityId === userId && c.rows.some(row => roleIds.includes(row.ROLE_ID)));
    if (conflict) return json({ error: "PENDING_CHANGE_REQUEST_CONFLICT", conflictingChangeRequestId: conflict.id }, 409);
    const id = `cr-${++state.crCounter}`;
    crs.push({ id, actionType: "GRANT_ROLES", entityType: "USER", entityId: userId, status: "PENDING", authorizationCount: 0, threshold: 1, readyToCommit: false, rows: roleIds.map(ROLE_ID => ({ USER_ID: userId, ROLE_ID })), createdAt: Date.now(), requestedBy: persona, comments: [] });
    return json({ status: "PENDING", changeRequestId: id, actionType: "GRANT_ROLES" }, 202);
  }
  if (path[0] === "iga" && path[1] === "change-requests" && path.length === 2 && method === "GET") {
    const status = url.searchParams.get("status");
    return json(crs.filter(c => !status || c.status === status).map(({ comments: _comments, ...c }) => c));
  }
  if (path[0] === "iga" && path[1] === "change-requests" && path.length === 4 && method === "POST") {
    const cr = crs.find(c => c.id === path[2]);
    if (!cr) return json({ error: "Change request not found" }, 404);
    const body = (parse(raw) ?? {}) as { requestModel?: unknown; reason?: unknown; body?: unknown };
    if (path[3] === "comments") { cr.comments.push({ body: String(body.body ?? ""), by: persona }); return json({ ok: true }, 201); }
    if (cr.status !== "PENDING") return json({ error: `Change request is ${cr.status}` }, 409);
    if (path[3] === "deny") {
      Object.assign(cr, { status: "DENIED", resolvedAt: Date.now(), resolvedBy: persona, denyReason: String(body.reason ?? "") });
      return empty(204);
    }
    if (path[3] === "approve") {
      if (body.requestModel === undefined) return json({ mode: "needs-approval", changeRequestId: cr.id, requestModel: b64(`REQUEST-${cr.id}`) });
      if (body.requestModel !== b64(`REQUEST-${cr.id}`)) return json({ error: "requestModel was not the one handed out in phase 1" }, 400);
      Object.assign(cr, { status: "APPROVED", authorizationCount: 1, readyToCommit: true, resolvedAt: Date.now(), resolvedBy: persona, authorizers: [{ username: persona, timestamp: Date.now() }] });
      return json({ mode: "recorded", committed: true, status: "APPROVED", authCount: 1, threshold: 1 });
    }
  }
  if (path.join("/") === "iga/role-policies/name/tide-realm-admin" && method === "GET") return json({ policy: b64("ADMIN-POLICY") });
  return json({ error: "Unknown admin route" }, 404);
}

export function installMockApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== window.location.origin || !(url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/"))) return realFetch(input, init);
    const raw = request.method === "GET" || request.method === "HEAD" ? null : await request.text();
    await new Promise(r => setTimeout(r, 250));
    const state = load();
    const response = handle(state, request.method, url, request.headers.get("X-Walkthrough-Persona") ?? "", raw);
    save(state);
    return response;
  };
}
