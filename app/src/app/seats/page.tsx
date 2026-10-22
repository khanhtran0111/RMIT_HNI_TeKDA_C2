"use client";

// /seats (SPEC section 5, Task A7): the rules of the vault, the seat, and the release itself.
// A seat files a release (a governed role grant -> TideCloak change request), then approves it in the
// Tide enclave, all from this page. Every TideCloak call goes straight from this browser with the
// seat's own DPoP token (secureFetch). Never through our server: an approval is credited to whoever
// sends the HTTP request.
//
// The role check below is UI gating only. TideCloak itself refuses a role grant or an approval from
// anyone who is not a realm admin, and our API checks the token on every route.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTideCloak } from "@tidecloak/nextjs";
import {
  approvalCount,
  asTime,
  base64ToBytes,
  bytesToBase64,
  findRowValues,
  formatTime,
  makeChangeRequestClient,
  type ApproveReply,
  type ChangeRequest,
  type ChangeRequestClient,
  type LogEntry,
} from "@/lib/tide/changeRequests";

const SEAT_ROLE = "tide-realm-admin";
const SEAT_ROLE_CLIENT = "realm-management";
const CONSOLE_URL = "http://localhost:8080/admin/heirloom/console/";
const HEIR_USERNAME = "long";
const CAPACITY_COMMENT = "Capacity assessment CA-DEMO-07 attached (synthetic)";
const DEFAULT_DENY_REASON = "Wrong request: Mai did not name Long for this item.";

type RecordId = "mai-care" | "mai-bank";
type PolicyPair = { owner: string | null; heir: string | null };
type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; data: PolicyPair }
  | { kind: "error"; message: string };

const RECORDS: { id: RecordId; title: string; heirRole: string; heirName: string }[] = [
  { id: "mai-care", title: "Care wishes", heirRole: "heir-care-mai", heirName: "no one holds it in this prototype" },
  { id: "mai-bank", title: "Bank and pension logins", heirRole: "heir-bank-mai", heirName: "Long, after release" },
];

// What each heir role opens, for the plain sentence on a request card.
const ROLE_OPENS: Record<string, string> = {
  "heir-bank-mai": "bank and pension logins",
  "heir-care-mai": "care wishes",
};

// The two release buttons. The care-wishes one is the wrong request the seat should deny.
const RELEASES: { key: string; label: string; role: string; named: boolean }[] = [
  { key: "bank", label: "Release bank logins to Long", role: "heir-bank-mai", named: true },
  { key: "care", label: "Release care wishes to Long", role: "heir-care-mai", named: false },
];

type ReleaseState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "filed"; status: number; crId: string | null; via: string }
  | { kind: "conflict"; status: number; crId: string | null }
  | { kind: "applied"; status: number }
  | { kind: "error"; status: number | "error"; message: string };

type ListState<T> = { kind: "idle" } | { kind: "loading" } | { kind: "loaded"; items: T } | { kind: "error"; message: string };

type CardResult = { tone: Tone; word: string; text: string; showConsole?: boolean };
type CardState = {
  busy?: boolean;
  attach?: boolean;
  reason?: string;
  result?: CardResult;
  /** requestModel from phase 1, kept when the enclave did not finish, so it can be reopened. */
  retryModel?: string;
};

export default function SeatsPage() {
  const {
    authenticated,
    isInitializing,
    login,
    getValueFromToken,
    getValueFromIdToken,
    secureFetch,
    approveTideRequests,
    baseURL,
    getConfig,
  } = useTideCloak();

  // approveTideRequests bumps the provider's reloadKey, which flips isInitializing back to true for a
  // moment. Once we have seen a session, keep rendering the page so results stay on screen.
  const everAuthed = useRef(false);
  if (authenticated) everAuthed.current = true;

  // Client role tide-realm-admin of realm-management, read from the SDK's parsed access token.
  let roles: string[] = [];
  if (authenticated) {
    try {
      const resourceAccess = getValueFromToken("resource_access") as
        | Record<string, { roles?: unknown }>
        | undefined;
      const r = resourceAccess?.[SEAT_ROLE_CLIENT]?.roles;
      roles = Array.isArray(r) ? r.map(String) : [];
    } catch {
      roles = [];
    }
  }
  const isSeat = roles.includes(SEAT_ROLE);
  const username = authenticated ? String(getValueFromIdToken("preferred_username") ?? "") : "";

  const [policies, setPolicies] = useState<Record<RecordId, LoadState>>({
    "mai-care": { kind: "loading" },
    "mai-bank": { kind: "loading" },
  });
  const [releases, setReleases] = useState<Record<string, ReleaseState>>({});
  const [pending, setPending] = useState<ListState<ChangeRequest[]>>({ kind: "idle" });
  const [decided, setDecided] = useState<ListState<{ approved: ChangeRequest[]; denied: ChangeRequest[] }>>({ kind: "idle" });
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [log, setLog] = useState<LogEntry[]>([]);

  // The context hands out a new secureFetch / approveTideRequests whenever its memo recomputes
  // (token refresh etc.). Keep the latest in refs so loads do not re-run on every refresh.
  const fetchRef = useRef(secureFetch);
  fetchRef.current = secureFetch;
  const approveRef = useRef(approveTideRequests);
  approveRef.current = approveTideRequests;

  const tcBase = String(baseURL || "").replace(/\/+$/, "");
  let realm = "heirloom";
  try {
    realm = String(getConfig()?.realm || "heirloom");
  } catch {
    realm = "heirloom";
  }

  const addLog = useCallback((e: LogEntry) => setLog((l) => [e, ...l].slice(0, 50)), []);

  const clientRef = useRef<ChangeRequestClient | null>(null);
  const clientKey = useRef("");
  const client = useCallback((): ChangeRequestClient => {
    const key = `${tcBase}|${realm}`;
    if (!tcBase) throw new Error("TideCloak base URL is not known yet (baseURL is empty)");
    if (!clientRef.current || clientKey.current !== key) {
      clientRef.current = makeChangeRequestClient((u, i) => fetchRef.current(u, i), tcBase, realm, addLog);
      clientKey.current = key;
    }
    return clientRef.current;
  }, [tcBase, realm, addLog]);

  // Ids looked up once, in this browser: Long's user id and the two heir roles' ids.
  const idsRef = useRef<{ longId: string; roles: Record<string, string> } | null>(null);
  const ensureIds = useCallback(async () => {
    if (idsRef.current) return idsRef.current;
    const c = client();
    const u = await c.findUser(HEIR_USERNAME);
    const longId = u.ok && Array.isArray(u.data) && u.data[0]?.id ? u.data[0].id : "";
    if (!longId) throw new Error(`could not find user ${HEIR_USERNAME} (HTTP ${u.status})`);
    const roleIds: Record<string, string> = {};
    for (const name of Object.keys(ROLE_OPENS)) {
      const r = await c.getRole(name);
      if (r.ok && r.data?.id) roleIds[name] = r.data.id;
    }
    idsRef.current = { longId, roles: roleIds };
    const n: Record<string, string> = { [longId]: "Long" };
    for (const [name, id] of Object.entries(roleIds)) n[id] = name;
    setNames(n);
    return idsRef.current;
  }, [client]);

  const loadPolicies = useCallback(async () => {
    for (const rec of RECORDS) {
      setPolicies((p) => ({ ...p, [rec.id]: { kind: "loading" } }));
      try {
        // secureFetch needs an absolute URL (it builds the DPoP proof's htu with new URL()).
        const url = `${window.location.origin}/api/policies?record=${encodeURIComponent(rec.id)}`;
        const res = await fetchRef.current(url);
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = body?.error?.message ?? res.statusText;
          setPolicies((p) => ({ ...p, [rec.id]: { kind: "error", message: `${res.status}: ${msg}` } }));
          continue;
        }
        const data: PolicyPair = {
          owner: typeof body?.owner === "string" && body.owner ? body.owner : null,
          heir: typeof body?.heir === "string" && body.heir ? body.heir : null,
        };
        setPolicies((p) => ({ ...p, [rec.id]: { kind: "loaded", data } }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setPolicies((p) => ({ ...p, [rec.id]: { kind: "error", message: msg } }));
      }
    }
  }, []);

  const refreshPending = useCallback(async (): Promise<ChangeRequest[]> => {
    setPending((p) => (p.kind === "loaded" ? p : { kind: "loading" }));
    try {
      const r = await client().list("PENDING");
      if (!r.ok || !Array.isArray(r.data)) {
        setPending({ kind: "error", message: `HTTP ${r.status}: ${r.text.slice(0, 200) || "no body"}` });
        return [];
      }
      const items = [...r.data].sort((a, b) => asTime(b.createdAt) - asTime(a.createdAt));
      setPending({ kind: "loaded", items });
      return items;
    } catch (e) {
      setPending({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      return [];
    }
  }, [client]);

  const refreshDecided = useCallback(async () => {
    setDecided((d) => (d.kind === "loaded" ? d : { kind: "loading" }));
    try {
      const c = client();
      const [a, d] = [await c.list("APPROVED"), await c.list("DENIED")];
      const recent = (x: typeof a) =>
        Array.isArray(x.data)
          ? [...x.data].sort((p, q) => asTime(q.resolvedAt ?? q.createdAt) - asTime(p.resolvedAt ?? p.createdAt)).slice(0, 5)
          : [];
      if (!a.ok && !d.ok) {
        setDecided({ kind: "error", message: `HTTP ${a.status} / ${d.status}` });
        return;
      }
      setDecided({ kind: "loaded", items: { approved: recent(a), denied: recent(d) } });
    } catch (e) {
      setDecided({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [client]);

  const refreshAll = useCallback(async () => {
    await refreshPending();
    await refreshDecided();
  }, [refreshPending, refreshDecided]);

  const loaded = useRef(false);
  useEffect(() => {
    if (!authenticated || !isSeat || !tcBase || loaded.current) return;
    loaded.current = true;
    void loadPolicies();
    void (async () => {
      try {
        await ensureIds();
      } catch {
        /* the log panel shows the failed lookup; names fall back to raw ids */
      }
      await refreshAll();
    })();
  }, [authenticated, isSeat, tcBase, loadPolicies, ensureIds, refreshAll]);

  // --- release ---------------------------------------------------------------------------------

  async function release(item: (typeof RELEASES)[number]) {
    setReleases((s) => ({ ...s, [item.key]: { kind: "working" } }));
    try {
      const ids = await ensureIds();
      const roleId = ids.roles[item.role];
      if (!roleId) throw new Error(`role ${item.role} not found in TideCloak`);
      const r = await client().grantRealmRole(ids.longId, { id: roleId, name: item.role });
      const data = (r.data ?? {}) as Record<string, unknown>;

      if (r.status === 202) {
        let crId = str(data.id) || str(data.changeRequestId);
        let via = "reply body";
        if (!crId && r.location) {
          crId = r.location.split("/").filter(Boolean).pop() ?? "";
          via = "Location header";
        }
        const list = await refreshPending();
        if (!crId) {
          const match = list.find(
            (c) => c.actionType === "GRANT_ROLES" && (c.entityId === ids.longId || findRowValues(c.rows, "USER_ID").includes(ids.longId)) &&
              (findRowValues(c.rows, "ROLE_ID").length === 0 || findRowValues(c.rows, "ROLE_ID").includes(roleId)),
          );
          crId = match?.id ?? "";
          via = crId ? "newest matching pending request" : "not found";
        }
        setReleases((s) => ({ ...s, [item.key]: { kind: "filed", status: r.status, crId: crId || null, via } }));
      } else if (r.status === 409) {
        const crId = str(data.conflictingChangeRequestId) || str((data.details as Record<string, unknown> | undefined)?.conflictingChangeRequestId) ||
          (/conflictingChangeRequestId"?\s*[:=]\s*"?([0-9a-zA-Z-]+)/.exec(r.text)?.[1] ?? "");
        setReleases((s) => ({ ...s, [item.key]: { kind: "conflict", status: r.status, crId: crId || null } }));
        await refreshPending();
      } else if (r.ok) {
        setReleases((s) => ({ ...s, [item.key]: { kind: "applied", status: r.status } }));
      } else {
        setReleases((s) => ({ ...s, [item.key]: { kind: "error", status: r.status, message: r.text.slice(0, 300) || "no body" } }));
      }
    } catch (e) {
      setReleases((s) => ({ ...s, [item.key]: { kind: "error", status: "error", message: e instanceof Error ? e.message : String(e) } }));
    }
  }

  // --- approve (two-phase, enclave) ------------------------------------------------------------

  const patchCard = (id: string, patch: Partial<CardState>) => setCards((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  function recordedResult(reply: ApproveReply | null, status: number): CardResult {
    const committed = reply?.committed === true;
    const count = typeof reply?.authCount === "number" ? `${reply.authCount} of ${reply.threshold ?? "?"} approvals` : "";
    const text = `HTTP ${status}, mode ${String(reply?.mode ?? "?")}, committed ${String(reply?.committed ?? "?")}, status ${String(reply?.status ?? "?")}${count ? `, ${count}` : ""}${reply?.readyToCommit !== undefined ? `, readyToCommit ${String(reply.readyToCommit)}` : ""}`;
    return committed
      ? { tone: "approved", word: "APPROVED, committed", text }
      : { tone: "pending", word: "Recorded, not committed", text: `${text}. Approve again re-runs the commit gates.`, showConsole: true };
  }

  // Opens the Tide enclave, then sends the signed request back (phase 2).
  async function enclaveThenPhase2(id: string, requestModel: string) {
    let results: Awaited<ReturnType<typeof approveTideRequests>>;
    try {
      results = await approveRef.current([{ id, request: base64ToBytes(requestModel) }]);
      addLog({ at: new Date().toLocaleTimeString(), step: "Tide enclave (approveTideRequests)", method: "-", url: "enclave", status: 200, body: JSON.stringify(results.map((r) => ({ id: r.id, approved: !!r.approved, denied: !!r.denied, pending: !!r.pending }))) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog({ at: new Date().toLocaleTimeString(), step: "Tide enclave (approveTideRequests)", method: "-", url: "enclave", status: "error", body: msg });
      patchCard(id, { busy: false, retryModel: requestModel, result: { tone: "refused", word: "Enclave did not finish", text: msg, showConsole: true } });
      return;
    }
    const item = results.find((r) => r.id === id) ?? results[0];
    if (!item?.approved?.request) {
      const word = item?.denied ? "Denied in the enclave" : item?.pending ? "Still pending in the enclave" : "No answer from the enclave";
      patchCard(id, { busy: false, retryModel: requestModel, result: { tone: item?.denied ? "refused" : "pending", word, text: JSON.stringify(item ?? null), showConsole: true } });
      return;
    }
    try {
      const p2 = await client().approvePhase2(id, bytesToBase64(item.approved.request));
      if (!p2.ok) {
        patchCard(id, { busy: false, result: { tone: "refused", word: "Phase 2 refused", text: `HTTP ${p2.status}: ${p2.text.slice(0, 300)}`, showConsole: true } });
      } else {
        patchCard(id, { busy: false, retryModel: undefined, result: recordedResult(p2.data, p2.status) });
      }
    } catch (e) {
      patchCard(id, { busy: false, result: { tone: "refused", word: "Phase 2 failed", text: e instanceof Error ? e.message : String(e), showConsole: true } });
    }
    await refreshAll();
  }

  // Called straight from the click: comment (optional) -> phase 1 -> enclave -> phase 2.
  async function approve(c: ChangeRequest) {
    const id = c.id;
    const st = cards[id] ?? {};
    patchCard(id, { busy: true, result: { tone: "pending", word: "Working", text: "Asking TideCloak for the request to sign." } });
    try {
      const api = client();
      if (st.attach) {
        const cm = await api.comment(id, CAPACITY_COMMENT);
        if (!cm.ok) {
          patchCard(id, { busy: false, result: { tone: "refused", word: "Document not attached", text: `HTTP ${cm.status}: ${cm.text.slice(0, 300)}` } });
          return;
        }
      }
      const p1 = await api.approvePhase1(id);
      if (!p1.ok) {
        patchCard(id, { busy: false, result: { tone: "refused", word: "Refused", text: `HTTP ${p1.status}: ${p1.text.slice(0, 300)}`, showConsole: true } });
        await refreshAll();
        return;
      }
      const reply = p1.data;
      if (reply?.mode === "needs-approval") {
        if (!reply.requestModel) {
          patchCard(id, { busy: false, result: { tone: "refused", word: "No requestModel", text: "TideCloak asked for approval but sent nothing to sign.", showConsole: true } });
          return;
        }
        patchCard(id, { result: { tone: "pending", word: "Sign in the Tide window", text: "The Tide enclave is open. Approve there." } });
        await enclaveThenPhase2(id, reply.requestModel);
        return;
      }
      patchCard(id, { busy: false, result: recordedResult(reply, p1.status) });
      await refreshAll();
    } catch (e) {
      patchCard(id, { busy: false, result: { tone: "refused", word: "Failed", text: e instanceof Error ? e.message : String(e), showConsole: true } });
    }
  }

  // Reopen the enclave from a fresh click (popup blocked, closed, or failed). First statement opens it.
  function reopenEnclave(id: string) {
    const model = cards[id]?.retryModel;
    if (!model) return;
    void enclaveThenPhase2(id, model);
    patchCard(id, { busy: true, result: { tone: "pending", word: "Sign in the Tide window", text: "The Tide enclave is open. Approve there." } });
  }

  async function deny(c: ChangeRequest) {
    const id = c.id;
    // Canon: deny does not check status. Only deny a card listed as PENDING, so re-check first.
    const current = await refreshPending();
    if (!current.some((x) => x.id === id && (x.status ?? "PENDING") === "PENDING")) {
      patchCard(id, { result: { tone: "muted", word: "No longer pending", text: "This request was already decided. Nothing was sent." } });
      await refreshDecided();
      return;
    }
    patchCard(id, { busy: true });
    try {
      const r = await client().deny(id, (cards[id]?.reason ?? DEFAULT_DENY_REASON).trim() || DEFAULT_DENY_REASON);
      patchCard(id, {
        busy: false,
        result: r.ok
          ? { tone: "refused", word: "DENIED", text: `HTTP ${r.status}. The role was not granted.` }
          : { tone: "refused", word: "Deny failed", text: `HTTP ${r.status}: ${r.text.slice(0, 300)}`, showConsole: true },
      });
    } catch (e) {
      patchCard(id, { busy: false, result: { tone: "refused", word: "Deny failed", text: e instanceof Error ? e.message : String(e), showConsole: true } });
    }
    await refreshAll();
  }

  // --- reading a request -----------------------------------------------------------------------

  function describe(c: ChangeRequest) {
    const roleIds = findRowValues(c.rows, "ROLE_ID");
    const userIds = findRowValues(c.rows, "USER_ID");
    const userId = userIds[0] ?? c.entityId ?? "";
    const user = names[userId] ?? (userId || "someone");
    const roleNames = roleIds.map((r) => names[r] ?? r);
    if (c.actionType === "GRANT_ROLES") {
      const role = roleNames.length ? roleNames.join(", ") : "(role not readable from the request)";
      const opens = roleNames.map((r) => ROLE_OPENS[r]).filter(Boolean);
      return {
        sentence: `Give ${user} the role ${role}${opens.length ? ` (opens: ${opens.join(", ")})` : ""}`,
        wrong: user === "Long" && roleNames.includes("heir-care-mai"),
      };
    }
    return { sentence: `${c.actionType ?? "Change"} on ${c.entityType ?? "entity"} ${names[c.entityId ?? ""] ?? c.entityId ?? ""}`.trim(), wrong: false };
  }

  // --- render ----------------------------------------------------------------------------------

  if (isInitializing && !everAuthed.current) {
    return (
      <Shell>
        <StateLine tone="muted" icon={<IconClock />} word="Loading" text="Checking your sign-in." />
      </Shell>
    );
  }

  if (!authenticated && (!isInitializing || !everAuthed.current)) {
    return (
      <Shell>
        <h1 style={h1}>Seats</h1>
        <StateLine tone="muted" icon={<IconLock />} word="Signed out" text="Sign in as a seat to see this page." />
        <button onClick={login} style={btnPrimary}>
          Sign in
        </button>
      </Shell>
    );
  }

  if (authenticated && !isSeat) {
    return (
      <Shell>
        <h1 style={h1}>Seats</h1>
        <StateLine
          tone="refused"
          icon={<IconX />}
          word="Not a seat"
          text={`${username || "This account"} does not hold ${SEAT_ROLE}. Only a seat sees this page. Sign out and in again if you were just made a seat.`}
        />
        <Link href="/" style={btnSecondary}>
          Back to start
        </Link>
      </Shell>
    );
  }

  const rows: { policyId: string; record: RecordId; who: string; access: string; value: LoadState; pick: "owner" | "heir" }[] =
    RECORDS.flatMap((rec) => [
      { policyId: `owner:${rec.id}`, record: rec.id, who: "Mai (role vault-owner-mai)", access: "read-write", value: policies[rec.id], pick: "owner" as const },
      { policyId: `heir:${rec.id}`, record: rec.id, who: `whoever holds ${rec.heirRole} (${rec.heirName})`, access: "read", value: policies[rec.id], pick: "heir" as const },
    ]);

  return (
    <Shell>
      <h1 style={h1}>Seats</h1>
      <StateLine tone="approved" icon={<IconCheck />} word="Seat" text={`Signed in as ${username || "a seat"}. You hold the seat.`} />

      <section style={card}>
        <h2 style={h2}>The rule</h2>
        <p style={{ margin: 0 }}>
          <strong>Notary Duc holds the only seat in this prototype.</strong> In production, release needs{" "}
          <strong>2 of 3 independent seats</strong> (doctor, notary, a friend); Heirloom is never a seat.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: "var(--space-3) 0 0", display: "grid", gap: "var(--space-2)" }}>
          <li style={liRow}>
            <span style={{ color: "var(--approved)", display: "inline-flex" }}><IconSeat /></span>
            <strong>Notary Duc</strong>
            <span style={{ color: "var(--text-muted)" }}>Mai&apos;s notary, the seat here</span>
            <code style={mono}>notary-duc</code>
          </li>
          <li style={liRow}>
            <span style={{ color: "var(--text-muted)", display: "inline-flex" }}><IconSeat /></span>
            <strong>Family doctor, Mai&apos;s friend</strong>
            <span style={{ color: "var(--text-muted)" }}>the other two seats, in production</span>
          </li>
          <li style={liRow}>
            <span style={{ color: "var(--refused)", display: "inline-flex" }}><IconX /></span>
            <strong>Heirloom Pty Ltd</strong>
            <span style={{ color: "var(--text-muted)" }}>runs the server: no seat</span>
          </li>
        </ul>
        <p style={{ margin: "var(--space-3) 0 0", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
          Your clicks below go straight from this browser to TideCloak with your own token. Heirloom&apos;s server never
          carries a release or an approval.
        </p>
      </section>

      <section style={card}>
        <h2 style={h2}>Release an item</h2>
        <p style={{ margin: "0 0 var(--space-3)", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
          A release asks TideCloak to give Long a role. TideCloak does not grant it: it files a change request that a seat
          must approve in the Tide enclave.
        </p>
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          {RELEASES.map((item) => {
            const s = releases[item.key] ?? { kind: "idle" };
            return (
              <div key={item.key} style={{ display: "grid", gap: "var(--space-2)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
                  <button onClick={() => void release(item)} disabled={s.kind === "working"} style={item.named ? btnPrimary : btnSecondary}>
                    {item.label}
                  </button>
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
                    role <code style={mono}>{item.role}</code> to <code style={mono}>{HEIR_USERNAME}</code>
                  </span>
                </div>
                <ReleaseLine state={s} />
              </div>
            );
          })}
        </div>
      </section>

      <section style={card}>
        <div style={headRow}>
          <h2 style={{ ...h2, margin: 0 }}>Pending requests</h2>
          <button onClick={() => void refreshAll()} style={btnSecondary}>Refresh</button>
        </div>
        {pending.kind === "idle" || pending.kind === "loading" ? (
          <StateLine tone="muted" icon={<IconClock />} word="Loading" text="Reading pending change requests from TideCloak." />
        ) : pending.kind === "error" ? (
          <StateLine tone="refused" icon={<IconX />} word="Could not load" text={pending.message} />
        ) : pending.items.length === 0 ? (
          <StateLine tone="muted" icon={<IconCheck />} word="None" text="Nothing is waiting for a seat." />
        ) : (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {pending.items.map((c) => {
              const d = describe(c);
              const st = cards[c.id] ?? {};
              return (
                <article key={c.id} style={{ ...subCard, borderLeft: `4px solid var(--pending)` }}>
                  <p style={{ margin: 0, fontSize: "var(--fs-h2)", fontFamily: "var(--font-head)", fontWeight: 600, lineHeight: 1.3 }}>{d.sentence}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", margin: "var(--space-2) 0" }}>
                    <Chip tone="pending" icon={<IconClock />} word="PENDING" />
                    <span style={{ fontWeight: 600 }}>{approvalCount(c)}</span>
                    {Array.isArray(c.authorizers) && c.authorizers.length > 0 && (
                      <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
                        approved by {c.authorizers.map((a) => a.username ?? "?").join(", ")}
                      </span>
                    )}
                  </div>
                  {d.wrong && (
                    <StateLine tone="refused" icon={<IconX />} word="Check" text="Mai named Long for the bank logins only, not the care wishes. A seat should deny this." />
                  )}
                  <p style={{ margin: "var(--space-2) 0", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
                    {c.actionType} on {c.entityType}, requested by {c.requestedBy ?? "?"}
                    {c.createdAt ? `, ${formatTime(c.createdAt)}` : ""} &middot; id <code style={mono}>{c.id}</code>
                  </p>
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", margin: "var(--space-2) 0", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!st.attach} onChange={(e) => patchCard(c.id, { attach: e.target.checked })} style={{ width: 20, height: 20 }} />
                    Attach the capacity assessment (synthetic)
                    <span style={mockBadge}>MOCK</span>
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)" }}>
                    <button onClick={() => void approve(c)} disabled={!!st.busy} style={btnPrimary}>
                      Approve (Tide enclave)
                    </button>
                    <button onClick={() => void deny(c)} disabled={!!st.busy} style={btnDanger}>
                      Deny
                    </button>
                    <input
                      aria-label="Reason for denying"
                      value={st.reason ?? DEFAULT_DENY_REASON}
                      onChange={(e) => patchCard(c.id, { reason: e.target.value })}
                      style={input}
                    />
                  </div>
                  <CardResultView result={st.result} retry={st.retryModel ? () => reopenEnclave(c.id) : undefined} />
                </article>
              );
            })}
          </div>
        )}
        {/* A result for a card that just left the pending list (approved or denied) stays visible here. */}
        {pending.kind === "loaded" &&
          Object.entries(cards)
            .filter(([id, s]) => s.result && !pending.items.some((c) => c.id === id))
            .map(([id, s]) => (
              <div key={id} style={{ marginTop: "var(--space-3)" }}>
                <p style={{ margin: "0 0 var(--space-1)", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
                  Last result for <code style={mono}>{id}</code>
                </p>
                <CardResultView result={s.result} retry={s.retryModel ? () => reopenEnclave(id) : undefined} />
              </div>
            ))}
      </section>

      <section style={card}>
        <h2 style={h2}>Recently decided</h2>
        {decided.kind === "idle" || decided.kind === "loading" ? (
          <StateLine tone="muted" icon={<IconClock />} word="Loading" text="Reading approved and denied requests." />
        ) : decided.kind === "error" ? (
          <StateLine tone="refused" icon={<IconX />} word="Could not load" text={decided.message} />
        ) : decided.items.approved.length + decided.items.denied.length === 0 ? (
          <StateLine tone="muted" icon={<IconClock />} word="None yet" text="No request has been approved or denied." />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--space-2)" }}>
            {[...decided.items.approved.map((c) => ({ c, ok: true })), ...decided.items.denied.map((c) => ({ c, ok: false }))]
              .sort((p, q) => asTime(q.c.resolvedAt ?? q.c.createdAt) - asTime(p.c.resolvedAt ?? p.c.createdAt))
              .map(({ c, ok }) => (
                <li key={c.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--border)" }}>
                  {ok ? <Chip tone="approved" icon={<IconCheck />} word="APPROVED, committed" /> : <Chip tone="refused" icon={<IconX />} word="DENIED" />}
                  <span>{describe(c).sentence}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
                    {c.resolvedBy ? `by ${c.resolvedBy}` : ""}
                    {c.resolvedAt ?? c.createdAt ? ` ${formatTime(c.resolvedAt ?? c.createdAt)}` : ""}
                    {!ok && c.denyReason ? ` - "${c.denyReason}"` : ""}
                  </span>
                </li>
              ))}
          </ul>
        )}
        <p style={{ margin: "var(--space-3) 0 0", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
          Long gets an approved role on his next sign-in: he signs out and back in.
        </p>
      </section>

      <section style={card}>
        <h2 style={h2}>Who may read each item</h2>
        <p style={{ margin: "0 0 var(--space-3)", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
          Signed once at setup. The Tide network checks these on every open; Heirloom cannot change them.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-small)" }}>
            <thead>
              <tr>
                <th style={th}>Record</th>
                <th style={th}>Who may read</th>
                <th style={th}>Access</th>
                <th style={th}>Policy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.policyId}>
                  <td style={td}><code style={mono}>{r.record}</code></td>
                  <td style={td}>{r.who}</td>
                  <td style={td}>{r.access}</td>
                  <td style={td}><PolicyCell state={r.value} pick={r.pick} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={loadPolicies} style={{ ...btnSecondary, marginTop: "var(--space-3)" }}>
          Reload policies
        </button>
      </section>

      <section style={card}>
        <div style={headRow}>
          <h2 style={{ ...h2, margin: 0 }}>Call log</h2>
          <button onClick={() => setLog([])} style={btnSecondary}>Clear</button>
        </div>
        <p style={{ margin: "0 0 var(--space-2)", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
          Every call this page made to TideCloak, newest first, so you can see where a flow stops.
        </p>
        {log.length === 0 ? (
          <span style={{ color: "var(--text-muted)" }}>No calls yet.</span>
        ) : (
          <pre style={pre}>
            {log.map((e) => `${e.at}  ${e.step}\n  ${e.method} ${e.url}\n  -> ${e.status}  ${e.body}`).join("\n\n")}
          </pre>
        )}
      </section>

      <section style={card}>
        <details>
          <summary style={{ cursor: "pointer", fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "var(--fs-h2)" }}>
            Fallback: release in the TideCloak console
          </summary>
          <ol style={{ margin: "var(--space-3) 0 0", paddingLeft: "1.4em", display: "grid", gap: "var(--space-2)" }}>
            <li>
              Open <code style={mono}>{CONSOLE_URL}</code> in <strong>your own</strong> browser profile.
            </li>
            <li>Users &rarr; <code style={mono}>long</code> &rarr; Role mapping &rarr; Assign role.</li>
            <li>
              Pick the realm role <code style={mono}>heir-bank-mai</code> and assign it. TideCloak files a change request
              instead of granting it.
            </li>
            <li>Change requests &rarr; select that request &rarr; Approve, and sign in the Tide window.</li>
            <li>With one seat the threshold is 1, so your approval commits it. (Production: 2 of 3 seats.)</li>
            <li>Long signs out and back in; the role reaches him on his next sign-in.</li>
          </ol>
          <a href={CONSOLE_URL} target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary, marginTop: "var(--space-3)" }}>
            Open the TideCloak console
          </a>
        </details>
      </section>
    </Shell>
  );
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function ReleaseLine({ state }: { state: ReleaseState }) {
  switch (state.kind) {
    case "idle":
      return null;
    case "working":
      return <StateLine tone="muted" icon={<IconClock />} word="Sending" text="Asking TideCloak to grant the role." />;
    case "filed":
      return (
        <StateLine
          tone="pending"
          icon={<IconClock />}
          word="Filed"
          text={`HTTP ${state.status}: TideCloak did not grant the role; it filed change request ${state.crId ?? "(id not returned: see Pending requests)"}${state.crId ? ` (id from ${state.via})` : ""}. A seat must approve it below.`}
        />
      );
    case "conflict":
      return (
        <StateLine
          tone="pending"
          icon={<IconClock />}
          word="Already pending"
          text={`HTTP ${state.status}: a request for this is already waiting${state.crId ? ` (${state.crId})` : ""}. Approve or deny it in Pending requests below.`}
        />
      );
    case "applied":
      return (
        <StateLine tone="refused" icon={<IconX />} word="Applied directly" text={`HTTP ${state.status}: TideCloak granted the role with no change request. IGA may be off on this realm.`} />
      );
    case "error":
      return <StateLine tone="refused" icon={<IconX />} word="Refused" text={`HTTP ${state.status}: ${state.message}`} />;
  }
}

function CardResultView({ result, retry }: { result?: CardResult; retry?: () => void }) {
  if (!result) return null;
  const icon = result.tone === "approved" ? <IconCheck /> : result.tone === "refused" ? <IconX /> : <IconClock />;
  return (
    <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
      <StateLine tone={result.tone} icon={icon} word={result.word} text={result.text} />
      {(retry || result.showConsole) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {retry && (
            <button onClick={retry} style={btnPrimary}>
              Open the Tide enclave
            </button>
          )}
          {result.showConsole && (
            <a href={CONSOLE_URL} target="_blank" rel="noopener noreferrer" style={btnSecondary}>
              Approve in the TideCloak console instead
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function PolicyCell({ state, pick }: { state: LoadState; pick: "owner" | "heir" }) {
  if (state.kind === "loading") {
    return <Chip tone="muted" icon={<IconClock />} word="Loading" />;
  }
  if (state.kind === "error") {
    return (
      <span style={{ display: "inline-grid", gap: "var(--space-1)" }}>
        <Chip tone="refused" icon={<IconX />} word="Could not load" />
        <code style={{ ...mono, color: "var(--refused-ink)" }}>{state.message}</code>
      </span>
    );
  }
  return state.data[pick] ? (
    <Chip tone="approved" icon={<IconCheck />} word="Signed" />
  ) : (
    <Chip tone="pending" icon={<IconClock />} word="not signed yet" />
  );
}

// --- small presentational pieces ---------------------------------------------------------------

type Tone = "approved" | "pending" | "refused" | "muted";
const TONE: Record<Tone, { fg: string; bg: string }> = {
  approved: { fg: "var(--approved)", bg: "var(--approved-tint)" },
  pending: { fg: "var(--pending)", bg: "var(--pending-tint)" },
  refused: { fg: "var(--refused)", bg: "var(--refused-tint)" },
  muted: { fg: "var(--text-muted)", bg: "var(--surface-sunk)" },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "var(--space-5)",
        background: "var(--bg)",
        color: "var(--text)",
        font: "400 var(--fs-body)/1.5 var(--font-body)",
        borderRadius: "var(--radius)",
        display: "grid",
        gap: "var(--space-4)",
      }}
    >
      {children}
    </main>
  );
}

function Chip({ tone, icon, word }: { tone: Tone; icon: React.ReactNode; word: string }) {
  const t = TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "2px 10px",
        borderRadius: "var(--radius-pill)",
        background: t.bg,
        color: t.fg,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {word}
    </span>
  );
}

function StateLine({ tone, icon, word, text }: { tone: Tone; icon: React.ReactNode; word: string; text: string }) {
  const t = TONE[tone];
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--space-1) var(--space-3)",
        padding: "var(--space-3)",
        borderRadius: "var(--radius)",
        background: t.bg,
        borderLeft: `4px solid ${t.fg}`,
      }}
    >
      <span style={{ color: t.fg, display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontWeight: 700 }}>
        {icon}
        {word}
      </span>
      <span style={{ wordBreak: "break-word" }}>{text}</span>
    </div>
  );
}

const svg = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const IconCheck = () => (<svg {...svg}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
const IconX = () => (<svg {...svg}><path d="M6 6l12 12M18 6L6 18" /></svg>);
const IconClock = () => (<svg {...svg}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
const IconLock = () => (<svg {...svg}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>);
const IconSeat = () => (<svg {...svg}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0114 0" /></svg>);

const h1: React.CSSProperties = { font: "700 var(--fs-h1)/1.2 var(--font-head)", margin: 0 };
const h2: React.CSSProperties = { font: "600 var(--fs-h2)/1.25 var(--font-head)", margin: "0 0 var(--space-3)" };
const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow)",
  padding: "var(--space-4)",
};
const subCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "var(--space-3)",
};
const headRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-3)" };
const liRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)" };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: "0.9em", wordBreak: "break-all" };
const pre: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-small)",
  background: "var(--surface-sunk)",
  padding: "var(--space-3)",
  borderRadius: "var(--radius)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  maxHeight: 360,
  overflowY: "auto",
  margin: 0,
};
const mockBadge: React.CSSProperties = {
  border: "1px dashed var(--mock-border)",
  color: "var(--mock)",
  borderRadius: "var(--radius-pill)",
  padding: "0 8px",
  fontSize: "var(--fs-small)",
  fontWeight: 600,
};
const input: React.CSSProperties = {
  flex: "1 1 260px",
  minWidth: 0,
  padding: "8px 12px",
  fontSize: "var(--fs-small)",
  fontFamily: "var(--font-body)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--text)",
};
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--space-2)",
  borderBottom: "2px solid var(--border-strong)",
  fontFamily: "var(--font-head)",
  fontWeight: 600,
};
const td: React.CSSProperties = { padding: "var(--space-2)", borderBottom: "1px solid var(--border)", verticalAlign: "top" };
const btnBase: React.CSSProperties = {
  display: "inline-block",
  justifySelf: "start",
  borderRadius: "var(--radius)",
  padding: "10px 20px",
  fontSize: "var(--fs-body)",
  fontWeight: 600,
  fontFamily: "var(--font-body)",
  textDecoration: "none",
  cursor: "pointer",
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: "var(--primary)", color: "var(--on-primary)", border: "none" };
const btnSecondary: React.CSSProperties = { ...btnBase, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-strong)" };
const btnDanger: React.CSSProperties = { ...btnBase, background: "var(--refused)", color: "var(--on-refused)", border: "none" };
