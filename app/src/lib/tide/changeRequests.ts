// changeRequests.ts: browser-side calls to TideCloak's IGA change-request API (canon
// iga-change-requests-api), made with the SIGNED-IN SEAT's own DPoP token via secureFetch.
// Never route these through our server: an approval is credited to whoever sent the HTTP request.
//
// Pure helpers + a small client factory. No React. Every call reports to `log` so the page can show
// where a flow stops.

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface LogEntry {
  at: string;
  step: string;
  method: string;
  url: string;
  status: number | "error";
  body: string;
}
export type LogFn = (e: LogEntry) => void;

export interface ChangeRequest {
  id: string;
  actionType?: string;
  entityType?: string;
  entityId?: string;
  status?: string;
  authorizationCount?: number;
  authorizers?: { username?: string; timestamp?: number | string }[];
  threshold?: number;
  readyToCommit?: boolean;
  rows?: unknown;
  createdAt?: number | string;
  resolvedAt?: number | string;
  resolvedBy?: string;
  requestedBy?: string;
  denyReason?: string;
}

export interface ApproveReply {
  mode?: "recorded" | "needs-approval" | string;
  changeRequestId?: string;
  requestModel?: string;
  committed?: boolean;
  authCount?: number;
  threshold?: number;
  readyToCommit?: boolean;
  status?: string;
  [k: string]: unknown;
}

export interface CallResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  text: string;
  location: string | null;
}

// --- bytes <-> base64 (chunked: never spread a large Uint8Array into fromCharCode) -------------

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- client -------------------------------------------------------------------------------------

export function makeChangeRequestClient(fetchFn: FetchFn, baseUrl: string, realm: string, log: LogFn) {
  const tc = baseUrl.replace(/\/+$/, "");
  const admin = `${tc}/admin/realms/${encodeURIComponent(realm)}`;
  const cr = `${admin}/iga/change-requests`;

  async function call<T>(step: string, method: string, url: string, body?: unknown): Promise<CallResult<T>> {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    try {
      const res = await fetchFn(url, init);
      const text = await res.text().catch(() => "");
      let data: T | null = null;
      if (text) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          data = null;
        }
      }
      const location = res.headers.get("Location");
      log({ at: now(), step, method, url, status: res.status, body: clip(text || (location ? `Location: ${location}` : "(empty body)")) });
      return { ok: res.ok, status: res.status, data, text, location };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log({ at: now(), step, method, url, status: "error", body: clip(msg) });
      throw e;
    }
  }

  return {
    consoleUrl: `${tc}/admin/${encodeURIComponent(realm)}/console/`,
    findUser: (username: string) =>
      call<{ id: string; username: string }[]>(`Look up user ${username}`, "GET", `${admin}/users?username=${encodeURIComponent(username)}&exact=true`),
    getRole: (name: string) => call<{ id: string; name: string }>(`Look up role ${name}`, "GET", `${admin}/roles/${encodeURIComponent(name)}`),
    grantRealmRole: (userId: string, role: { id: string; name: string }) =>
      call<Record<string, unknown>>(`File a release: grant ${role.name}`, "POST", `${admin}/users/${encodeURIComponent(userId)}/role-mappings/realm`, [
        { id: role.id, name: role.name },
      ]),
    list: (status: "PENDING" | "APPROVED" | "DENIED") =>
      call<ChangeRequest[]>(`List ${status.toLowerCase()} requests`, "GET", `${cr}?status=${status}`),
    comment: (id: string, body: string) =>
      call<unknown>("Attach a document (comment)", "POST", `${cr}/${encodeURIComponent(id)}/comments`, { body }),
    approvePhase1: (id: string) =>
      call<ApproveReply>("Approve, step 1 of 2: ask for the request to sign {}", "POST", `${cr}/${encodeURIComponent(id)}/approve`, {}),
    approvePhase2: (id: string, requestModel: string) =>
      call<ApproveReply>("Approve, step 2 of 2: send the signed request {requestModel}", "POST", `${cr}/${encodeURIComponent(id)}/approve`, { requestModel }),
    deny: (id: string, reason: string) => call<unknown>("Deny", "POST", `${cr}/${encodeURIComponent(id)}/deny`, { reason }),
  };
}

export type ChangeRequestClient = ReturnType<typeof makeChangeRequestClient>;

// --- reading a change request -------------------------------------------------------------------

/** Every string value under a key whose name contains `needle` (e.g. ROLE_ID, USER_ID), any depth. */
export function findRowValues(rows: unknown, needle: string): string[] {
  const out: string[] = [];
  const n = needle.toUpperCase();
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || v === null || v === undefined) return;
    if (Array.isArray(v)) {
      v.forEach((x) => walk(x, depth + 1));
      return;
    }
    if (typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        const key = k.toUpperCase().replace(/[^A-Z]/g, "");
        if (key.includes(n.replace(/[^A-Z]/g, "")) && (typeof x === "string" || typeof x === "number")) out.push(String(x));
        else walk(x, depth + 1);
      }
      return;
    }
    if (typeof v === "string" && v.trim().startsWith("{")) {
      try {
        walk(JSON.parse(v), depth + 1);
      } catch {
        /* not JSON */
      }
    }
  };
  walk(rows, 0);
  return Array.from(new Set(out));
}

/** "N of M approvals" from the list object. Never defaults the count to 0. */
export function approvalCount(c: ChangeRequest): string {
  if (typeof c.authorizationCount === "number") {
    return `${c.authorizationCount} of ${typeof c.threshold === "number" ? c.threshold : "?"} approvals`;
  }
  if (typeof c.readyToCommit === "boolean") return c.readyToCommit ? "Ready to commit" : "Waiting for approvals";
  return "Approval count not reported";
}

export function asTime(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
    const d = Date.parse(v);
    return Number.isNaN(d) ? 0 : d;
  }
  return 0;
}

/** Date and time in the viewer's own locale and time zone, e.g. "22 Oct 2026, 14:05". */
export function formatTime(v: unknown): string {
  const t = asTime(v);
  return t ? new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
}

function now() {
  return new Date().toLocaleTimeString();
}
function clip(s: string) {
  return s.length > 300 ? `${s.slice(0, 300)}...` : s;
}
