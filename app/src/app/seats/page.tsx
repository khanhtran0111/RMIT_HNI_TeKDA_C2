"use client";

// /seats (SPEC section 5, Task A7): the rules of the vault, the seat, and the release itself.
// A seat files a release (a governed role grant -> TideCloak change request), then approves it in the
// Tide enclave, all from this page. Every TideCloak call goes straight from this browser with the
// seat's own DPoP token (secureFetch). Never through our server: an approval is credited to whoever
// sends the HTTP request.
//
// The role check below is UI gating only. TideCloak itself refuses a role grant or an approval from
// anyone who is not a realm admin, and our API checks the token on every route.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessGate, AppShell } from "@/components/AppShell";
import { useSession } from "@/components/Session";
import { Icon } from "@/components/Icon";
import { StatusChip } from "@/components/StatusChip";
import { Callout, Card, Person, SectionHeader, Stepper, displayName, type Step } from "@/components/ui";
import { Term } from "@/components/Term";
import { CompareCard, TideProof } from "@/components/tide";
import styles from "./seats.module.css";
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

const CONSOLE_URL = "http://localhost:8080/admin/heirloom/console/";
/** After this long with no answer from the Tide window, show the way out (the call itself keeps waiting). */
const ENCLAVE_WATCHDOG_MS = 25_000;
const ENCLAVE_WAIT_HINT =
  "No answer from the Tide window yet. If it is open, finish signing there. If it never opened, allow pop-ups for this site and click Open the Tide enclave. If it opened blank or was closed, approve in the TideCloak console instead, or reload this page.";
const HEIR_USERNAME = "long";
const CAPACITY_COMMENT = "Capacity assessment CA-DEMO-07 attached (synthetic)";
const DEFAULT_DENY_REASON = "Wrong request: Mai did not name Long for this item.";

// The "Before you approve" checklist on each pending request. Presentation only: it gates the
// Approve button in this browser and sends nothing. TideCloak's own checks are unchanged.
const CHECKS: readonly string[] = [
  "I confirmed the request is for the person Mai named",
  "I reviewed the capacity assessment (synthetic)",
  "I understand approving gives Long access to this item only",
];

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
// Short form for the "What Tide just did" line after a committed approval.
const ROLE_SHORT: Record<string, string> = {
  "heir-bank-mai": "the bank logins",
  "heir-care-mai": "the care wishes",
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

type Tone = "approved" | "pending" | "refused" | "muted";
/** `enclave`: the commit followed a signature in the Tide enclave (phase 2), not a direct phase-1 commit. */
type CardResult = { tone: Tone; word: string; text: string; showConsole?: boolean; enclave?: boolean };
type CardState = {
  busy?: boolean;
  attach?: boolean;
  reason?: string;
  result?: CardResult;
  /** requestModel from phase 1, kept when the enclave did not finish, so it can be reopened. */
  retryModel?: string;
  /** Ticks in the "Before you approve" checklist, one per entry in CHECKS. UI gating only. */
  checks?: boolean[];
};

export default function SeatsPage() {
  const session = useSession();
  const { authenticated, isInitializing, isSeat, username, secureFetch, approveTideRequests, baseURL, getConfig } = session;

  // approveTideRequests bumps the provider's reloadKey: isInitializing flips back to true for a moment and
  // isSeat reads false until it settles. Every piece of state lives here, in a component that never
  // unmounts, and once a seat session has been seen the page keeps rendering through that moment instead
  // of the access gate, so the approval result stays on screen and the scroll position is kept.
  const everSeat = useRef(false);
  if (authenticated && isSeat) everSeat.current = true;
  const showPage = (authenticated && isSeat) || (isInitializing && everSeat.current);

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

  // Requests seen on screen, by id, so a result can still name who receives what after the request
  // has left the pending list. Presentation only.
  const seenRef = useRef<Record<string, ChangeRequest>>({});

  // One counter per card for enclave attempts. Only a new attempt (retry or Approve again) makes an older
  // one stale, so a late result from it can neither overwrite the newer one nor send phase 2 twice.
  const attemptRef = useRef<Record<string, number>>({});

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

      // IGA answers 202 on some builds and 204 on others while still filing a change request, so any
      // 2xx is checked against the pending list before it is reported as applied.
      if (r.ok) {
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
        if (!crId && r.status !== 202) setReleases((s) => ({ ...s, [item.key]: { kind: "applied", status: r.status } }));
        else setReleases((s) => ({ ...s, [item.key]: { kind: "filed", status: r.status, crId: crId || null, via } }));
      } else if (r.status === 409) {
        const crId = str(data.conflictingChangeRequestId) || str((data.details as Record<string, unknown> | undefined)?.conflictingChangeRequestId) ||
          (/conflictingChangeRequestId"?\s*[:=]\s*"?([0-9a-zA-Z-]+)/.exec(r.text)?.[1] ?? "");
        setReleases((s) => ({ ...s, [item.key]: { kind: "conflict", status: r.status, crId: crId || null } }));
        await refreshPending();
      } else {
        setReleases((s) => ({ ...s, [item.key]: { kind: "error", status: r.status, message: r.text.slice(0, 300) || "no body" } }));
      }
    } catch (e) {
      setReleases((s) => ({ ...s, [item.key]: { kind: "error", status: "error", message: e instanceof Error ? e.message : String(e) } }));
    }
  }

  // --- approve (two-phase, enclave) ------------------------------------------------------------

  const patchCard = (id: string, patch: Partial<CardState>) => setCards((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  function recordedResult(reply: ApproveReply | null, status: number, enclave = false): CardResult {
    const committed = reply?.committed === true;
    const count = typeof reply?.authCount === "number" ? `${reply.authCount} of ${reply.threshold ?? "?"} approvals` : "";
    const text = `HTTP ${status}, mode ${String(reply?.mode ?? "?")}, committed ${String(reply?.committed ?? "?")}, status ${String(reply?.status ?? "?")}${count ? `, ${count}` : ""}${reply?.readyToCommit !== undefined ? `, readyToCommit ${String(reply.readyToCommit)}` : ""}`;
    return committed
      ? { tone: "approved", word: "APPROVED, committed", text, enclave }
      : { tone: "pending", word: "Recorded, not committed", text: `${text}. Approve again re-runs the commit gates.`, showConsole: true };
  }

  // Opens the Tide enclave, then sends the signed request back (phase 2).
  async function enclaveThenPhase2(id: string, requestModel: string) {
    const attempt = (attemptRef.current[id] ?? 0) + 1;
    attemptRef.current[id] = attempt;
    const stale = () => attemptRef.current[id] !== attempt;
    let results: Awaited<ReturnType<typeof approveTideRequests>>;
    let watchdog: number | undefined;
    try {
      // First call in this function: opening the window must stay inside the click that started it.
      const call = approveRef.current([{ id, request: base64ToBytes(requestModel) }]);
      // A blocked window, or one closed before it loaded, never settles this call. Give the seat a way out
      // without marking the attempt stale: a slow but real sign-in must still be able to finish.
      watchdog = window.setTimeout(() => {
        if (stale()) return;
        patchCard(id, { busy: false, retryModel: requestModel, result: { tone: "pending", word: "Still waiting for the Tide window", text: ENCLAVE_WAIT_HINT, showConsole: true } });
      }, ENCLAVE_WATCHDOG_MS);
      results = await call;
      window.clearTimeout(watchdog);
      addLog({ at: new Date().toLocaleTimeString(), step: "Tide enclave: sign the approval", method: "-", url: "enclave", status: 200, body: JSON.stringify(results.map((r) => ({ id: r.id, approved: !!r.approved, denied: !!r.denied, pending: !!r.pending }))) + (stale() ? " (ignored: a newer attempt started)" : "") });
    } catch (e) {
      window.clearTimeout(watchdog);
      const msg = e instanceof Error ? e.message : String(e);
      addLog({ at: new Date().toLocaleTimeString(), step: "Tide enclave: sign the approval", method: "-", url: "enclave", status: "error", body: msg + (stale() ? " (ignored: a newer attempt started)" : "") });
      if (stale()) return;
      patchCard(id, { busy: false, retryModel: requestModel, result: { tone: "refused", word: "The Tide window did not finish", text: msg, showConsole: true } });
      return;
    }
    if (stale()) return;
    const item = results.find((r) => r.id === id) ?? results[0];
    if (!item?.approved?.request) {
      const word = item?.denied ? "Denied in the Tide window" : item?.pending ? "Still pending in the Tide window" : "No answer from the Tide window";
      patchCard(id, { busy: false, retryModel: requestModel, result: { tone: item?.denied ? "refused" : "pending", word, text: JSON.stringify(item ?? null), showConsole: true } });
      return;
    }
    try {
      const p2 = await client().approvePhase2(id, bytesToBase64(item.approved.request));
      if (!p2.ok) {
        patchCard(id, { busy: false, result: { tone: "refused", word: "TideCloak refused the signed approval", text: `HTTP ${p2.status}: ${p2.text.slice(0, 300)}`, showConsole: true } });
      } else {
        patchCard(id, { busy: false, retryModel: undefined, result: recordedResult(p2.data, p2.status, true) });
      }
    } catch (e) {
      patchCard(id, { busy: false, result: { tone: "refused", word: "Sending the signed approval failed", text: e instanceof Error ? e.message : String(e), showConsole: true } });
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
          patchCard(id, { busy: false, result: { tone: "refused", word: "Nothing to sign", text: "TideCloak asked for approval but sent no request to sign.", showConsole: true } });
          return;
        }
        patchCard(id, { result: { tone: "pending", word: "Sign in the Tide window", text: "The Tide enclave is open. Approve there with your own key." } });
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
    patchCard(id, { busy: true, result: { tone: "pending", word: "Sign in the Tide window", text: "The Tide enclave is open. Approve there with your own key." } });
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
    // A Tide window still open from an earlier Approve must not send its approval after this deny.
    attemptRef.current[id] = (attemptRef.current[id] ?? 0) + 1;
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
      const opens = roleNames.map((r) => ROLE_OPENS[r]).filter(Boolean);
      const sentence = opens.length
        ? `Release ${opens.join(" and ")} to ${user}`
        : `Give ${user} ${roleNames.length ? `the role ${roleNames.join(", ")}` : "a role (not readable from the request)"}`;
      return { sentence, user, roles: roleNames, wrong: user === "Long" && roleNames.includes("heir-care-mai") };
    }
    return {
      sentence: `${c.actionType ?? "Change"} on ${c.entityType ?? "entity"} ${names[c.entityId ?? ""] ?? c.entityId ?? ""}`.trim(),
      user: "",
      roles: [] as string[],
      wrong: false,
    };
  }

  /** The "What Tide just did" lines for a committed approval. Only what this page observed. */
  function approvedProof(id: string, result: CardResult): string[] {
    const c = seenRef.current[id];
    const d = c ? describe(c) : null;
    const short = d?.roles.map((r) => ROLE_SHORT[r]).find(Boolean);
    const first = result.enclave ? "Approved in the Tide enclave and committed by TideCloak." : "Approved and committed by TideCloak.";
    if (d?.user === "Long" && short) return [first, `Long receives the heir role at his next sign-in; ${short} open for him only.`];
    return [first, `${d?.user && d.user !== "someone" ? d.user : "The recipient"} receives the role at the next sign-in.`];
  }

  // --- render ----------------------------------------------------------------------------------

  if (pending.kind === "loaded") for (const c of pending.items) seenRef.current[c.id] = c;
  if (decided.kind === "loaded") for (const c of [...decided.items.approved, ...decided.items.denied]) seenRef.current[c.id] ??= c;

  const hasPending = pending.kind === "loaded" && pending.items.length > 0;

  const rows: { policyId: string; record: RecordId; title: string; who: ReactNode; access: string; value: LoadState; pick: "owner" | "heir" }[] =
    RECORDS.flatMap((rec) => [
      {
        policyId: `owner:${rec.id}`,
        record: rec.id,
        title: rec.title,
        who: <>Mai, the vault owner <code className="tag">vault-owner-mai</code></>,
        access: "Read and change",
        value: policies[rec.id],
        pick: "owner" as const,
      },
      {
        policyId: `heir:${rec.id}`,
        record: rec.id,
        title: rec.title,
        who: <>Whoever holds <code className="tag">{rec.heirRole}</code> <span className="muted">({rec.heirName})</span></>,
        access: "Read only",
        value: policies[rec.id],
        pick: "heir" as const,
      },
    ]);

  const page = (
    <div className="stack-lg">
      <Card as="section" labelledBy="rules-h">
        <SectionHeader
          id="rules-h"
          eyebrow="How a release works"
          title="Releasing an item needs a seat"
          description={
            <>
              A <Term id="seat">seat</Term> is an independent person Mai trusts. Nothing is released until a seat
              approves it in the <Term id="enclave">Tide enclave</Term>, a signing window outside Heirloom. A seat cannot
              read the items either.
            </>
          }
        />
        <p>
          <strong>Prototype:</strong> Notary Duc is the only seat. <strong>Production:</strong> 2 of 3 independent seats;
          Heirloom is never a seat.
        </p>
        <ul className="grid-3 seats-people">
          <li>
            <Person name="notary-duc" role="Mai's notary" />
            <span className="seats-role seats-role-yes"><Icon name="shieldCheck" size={18} />The seat in this prototype</span>
            {username === "notary-duc" && <span className="seats-you">You</span>}
          </li>
          <li>
            <span className="person">
              <span className="seats-tile-icon"><Icon name="users" size={18} /></span>
              <span className="person-text"><span className="person-name">Family doctor and a friend</span><span className="person-role">Chosen by Mai</span></span>
            </span>
            <span className="seats-role seats-role-later"><Icon name="clock" size={18} />Seats 2 and 3 in production</span>
          </li>
          <li>
            <span className="person">
              <span className="seats-tile-icon"><Icon name="server" size={18} /></span>
              <span className="person-text"><span className="person-name">Heirloom, the company</span><span className="person-role">Runs the servers</span></span>
            </span>
            <span className="seats-role seats-role-no"><Icon name="x" size={18} />Never a seat</span>
          </li>
        </ul>
        <p className="help with-icon">
          <Icon name="network" size={18} />
          Your clicks on this page go straight from this browser to TideCloak with your own token. Heirloom&apos;s server never
          carries a release or an approval.
        </p>
      </Card>

      <div className="workspace-grid">
        <div className="stack">
          <Card as="section" labelledBy="release-h">
            <SectionHeader
              id="release-h"
              eyebrow="Step 1"
              title="Release an item"
              description="A release asks TideCloak to give Long a role. TideCloak does not grant it straight away: it files a request that a seat must approve."
            />
            <ul className="seats-rows">
              {RELEASES.map((item) => {
                const s = releases[item.key] ?? { kind: "idle" };
                const rec = RECORDS.find((r) => r.heirRole === item.role);
                return (
                  <li key={item.key}>
                    <div className="seats-row-head">
                      <div className="stack-sm">
                        <h3>{rec?.title ?? item.role}</h3>
                        <div className="seats-meta">
                          <Person name={HEIR_USERNAME} size="sm" role={item.named ? "Named by Mai" : "Not named by Mai for this item"} />
                          <code className="tag">{item.role}</code>
                        </div>
                      </div>
                      <button
                        className={item.named && !hasPending ? undefined : "button-secondary"}
                        onClick={() => void release(item)}
                        disabled={s.kind === "working"}
                      >
                        <Icon name="send" size={18} />
                        {item.label}
                      </button>
                    </div>
                    {!item.named && (
                      <p className="help with-icon">
                        <Icon name="alert" size={16} />
                        Check before approving: Mai named Linh, not Long, for her care wishes.
                      </p>
                    )}
                    <ReleaseLine state={s} />
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card as="section" labelledBy="pending-h">
            <SectionHeader
              id="pending-h"
              eyebrow="Step 2"
              title="Waiting for your approval"
              description="Check who receives what. Approve in the Tide enclave, or deny with a reason."
              action={
                <button className="button-secondary button-sm" onClick={() => void refreshAll()}>
                  Refresh
                </button>
              }
            />
            <div aria-live="polite">
              {pending.kind === "idle" || pending.kind === "loading" ? (
                <p className="loading-line" role="status">Reading pending requests from TideCloak…</p>
              ) : pending.kind === "error" ? (
                <Callout tone="danger" role="alert" title="Could not load the requests">
                  <p className="seats-result-text">{pending.message}</p>
                </Callout>
              ) : pending.items.length === 0 ? (
                <p className="seats-empty"><Icon name="check" size={18} />Nothing is waiting for a seat. File a release in step 1 to start.</p>
              ) : (
                <ul className="seats-list">
                  {pending.items.map((c) => {
                    const d = describe(c);
                    const st = cards[c.id] ?? {};
                    const committed = st.result?.tone === "approved";
                    const ticks = CHECKS.map((_, i) => !!st.checks?.[i]);
                    const ticked = ticks.filter(Boolean).length;
                    const ready = ticked === CHECKS.length;
                    const toggleCheck = (i: number, on: boolean) =>
                      patchCard(c.id, { checks: ticks.map((v, j) => (j === i ? on : v)) });
                    const steps: Step[] = [
                      { label: "Requested", detail: c.requestedBy ? `By ${displayName(c.requestedBy)}` : undefined, state: "done" },
                      { label: "Approved", detail: approvalCount(c), state: committed ? "done" : "current" },
                      { label: "Released", detail: d.user && d.user !== "someone" ? `Opens for ${d.user} at the next sign-in` : "At the next sign-in", state: committed ? "done" : "upcoming" },
                    ];
                    return (
                      <Card as="li" key={c.id} className={`seats-request ${styles.request}`}>
                        <div className="seats-request-head">
                          <h3>{d.sentence}</h3>
                          <StatusChip state="pending" />
                        </div>
                        <div className="seats-meta">
                          {d.user && d.user !== "someone" && <Person name={d.user} size="sm" role="Receives it" />}
                          {d.roles.map((r) => <code className="tag" key={r}>{r}</code>)}
                          <span>
                            TideCloak request <code className="tag">{c.id}</code>
                          </span>
                          {c.createdAt ? <span>{formatTime(c.createdAt)}</span> : null}
                        </div>
                        <Stepper label={`Progress of request ${c.id}`} steps={steps} />
                        {d.wrong && (
                          <Callout tone="danger" title="Check this against Mai's wishes">
                            <p>Mai named Long for the bank logins only, not the care wishes. A seat should deny this.</p>
                          </Callout>
                        )}
                        {Array.isArray(c.authorizers) && c.authorizers.length > 0 && (
                          <p className="help">Approved so far by {c.authorizers.map((a) => displayName(a.username ?? "?")).join(", ")}</p>
                        )}
                        <div className="stack-sm">
                          <label className="seats-check">
                            <input type="checkbox" checked={!!st.attach} onChange={(e) => patchCard(c.id, { attach: e.target.checked })} />
                            <span>
                              Attach the capacity assessment <span className="tag">MOCK</span>
                            </span>
                          </label>
                          <p className="help">A synthetic document (CA-DEMO-07), added to the request as a comment before you approve.</p>
                        </div>
                        <fieldset className={styles.checklist}>
                          <legend className={styles.legend}>
                            <Icon name="shieldCheck" size={18} />
                            <span className={styles.legendText}>Before you approve</span>
                            <span className={`${styles.count}${ready ? ` ${styles.countDone}` : ""}`} aria-hidden="true">
                              {ticked} of {CHECKS.length}
                            </span>
                          </legend>
                          <ul className={styles.list}>
                            {CHECKS.map((text, i) => (
                              <li key={text} className={styles.item}>
                                <label className={styles.check}>
                                  <input type="checkbox" checked={ticks[i]} onChange={(e) => toggleCheck(i, e.target.checked)} />
                                  <span>{text}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </fieldset>
                        <div className="field">
                          <label htmlFor={`deny-reason-${c.id}`}>Reason, if you deny</label>
                          <input
                            id={`deny-reason-${c.id}`}
                            value={st.reason ?? DEFAULT_DENY_REASON}
                            onChange={(e) => patchCard(c.id, { reason: e.target.value })}
                          />
                        </div>
                        <div className="actions">
                          <button
                            onClick={() => void approve(c)}
                            disabled={!!st.busy || !ready}
                            aria-describedby={`approve-why-${c.id}`}
                          >
                            <Icon name="shieldCheck" size={18} />
                            Approve in the Tide enclave
                          </button>
                          <button className="button-danger" onClick={() => void deny(c)} disabled={!!st.busy}>
                            <Icon name="x" size={18} />
                            Deny
                          </button>
                        </div>
                        <p id={`approve-why-${c.id}`} className={`${styles.why}${ready ? ` ${styles.whyReady}` : ""}`}>
                          <Icon name={ready ? "check" : "lock"} size={18} />
                          <span>
                            {ready
                              ? "All 3 checks done. You can approve now."
                              : `Approve unlocks when all 3 checks are ticked (${ticked} of 3 done). You can deny at any time.`}
                          </span>
                        </p>
                        <p className="help">
                          Approving opens the Tide enclave, a secure window where you sign with your own key. Heirloom cannot
                          approve for you.
                        </p>
                        <CardResultView
                          result={st.result}
                          busy={!!st.busy}
                          proof={st.result?.tone === "approved" ? approvedProof(c.id, st.result) : undefined}
                          retry={st.retryModel ? () => reopenEnclave(c.id) : undefined}
                        />
                      </Card>
                    );
                  })}
                </ul>
              )}
              {/* A result for a card that just left the pending list (approved or denied) stays visible here. */}
              {pending.kind === "loaded" &&
                Object.entries(cards)
                  .filter(([id, s]) => s.result && !pending.items.some((c) => c.id === id))
                  .map(([id, s]) => {
                    const c = seenRef.current[id];
                    const committed = s.result?.tone === "approved";
                    return (
                      <div key={id} className="seats-last">
                        <p className="help">
                          Last result for TideCloak request <code className="tag">{id}</code>
                          {c ? `: ${describe(c).sentence}` : ""}
                        </p>
                        {committed && (
                          <Stepper
                            label={`Progress of request ${id}`}
                            steps={[
                              { label: "Requested", state: "done" },
                              { label: "Approved", detail: s.result?.enclave ? "By you, in the Tide enclave" : "By you", state: "done" },
                              { label: "Released", detail: c && describe(c).user === "Long" ? "At Long's next sign-in" : "At the recipient's next sign-in", state: "done" },
                            ]}
                          />
                        )}
                        <CardResultView
                          result={s.result}
                          busy={!!s.busy}
                          proof={s.result?.tone === "approved" ? approvedProof(id, s.result) : undefined}
                          retry={s.retryModel ? () => reopenEnclave(id) : undefined}
                        />
                      </div>
                    );
                  })}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card as="section" labelledBy="decided-h">
            <SectionHeader id="decided-h" eyebrow="History" title="Recently decided" />
            {decided.kind === "idle" || decided.kind === "loading" ? (
              <p className="loading-line" role="status">Reading approved and denied requests…</p>
            ) : decided.kind === "error" ? (
              <Callout tone="danger" role="alert" title="Could not load">
                <p className="seats-result-text">{decided.message}</p>
              </Callout>
            ) : decided.items.approved.length + decided.items.denied.length === 0 ? (
              <p className="seats-empty"><Icon name="clock" size={18} />No request has been approved or denied yet.</p>
            ) : (
              <ul className="seats-decided">
                {[...decided.items.approved.map((c) => ({ c, ok: true })), ...decided.items.denied.map((c) => ({ c, ok: false }))]
                  .sort((p, q) => asTime(q.c.resolvedAt ?? q.c.createdAt) - asTime(p.c.resolvedAt ?? p.c.createdAt))
                  .map(({ c, ok }) => (
                    <li key={c.id}>
                      {ok ? <StatusChip state="released" label="APPROVED" /> : <StatusChip state="refused" label="DENIED" />}
                      <span className="seats-decided-title">{describe(c).sentence}</span>
                      <span className="help">
                        {c.resolvedBy ? `By ${displayName(c.resolvedBy)}` : ""}
                        {c.resolvedAt ?? c.createdAt ? `${c.resolvedBy ? " · " : ""}${formatTime(c.resolvedAt ?? c.createdAt)}` : ""}
                      </span>
                      {!ok && c.denyReason && <span className="help">Reason: &ldquo;{c.denyReason}&rdquo;</span>}
                    </li>
                  ))}
              </ul>
            )}
          </Card>
          <Callout tone="info" title="What happens next">
            <p>Long gets an approved role on his next sign-in: he signs out and back in. Then only the item Mai named for him opens.</p>
          </Callout>
        </div>
      </div>

      <CompareCard
        title="An ordinary app vs Heirloom on Tide"
        description="Who can hand one of Mai's items to someone else."
        rows={[
          {
            label: "Giving someone access",
            ordinary: "Any admin can grant it in one step, and it applies at once.",
            tide: "TideCloak files a request. Nothing changes until a seat approves it in the Tide enclave.",
          },
          {
            label: "The company running the app",
            ordinary: "Its admins can approve their own changes.",
            tide: "Heirloom is never a seat, and its server never carries a release or an approval.",
          },
          {
            label: "The person who approves",
            ordinary: "Usually sees the data too.",
            tide: "A seat can approve a release but cannot open any item.",
          },
        ]}
      />

      <Card as="section" labelledBy="policies-h">
        <SectionHeader
          id="policies-h"
          title="Who may open each item"
          description={
            <>
              Each item has a signed{" "}
              <Term id="policy">policy</Term>. They were signed once
              at setup; the Tide network checks them on every open, and Heirloom cannot change them.
            </>
          }
          action={
            <button className="button-secondary button-sm" onClick={() => void loadPolicies()}>
              Reload policies
            </button>
          }
        />
        <div className="table-scroll">
          <table className="seats-policy-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Who may open it</th>
                <th scope="col">Access</th>
                <th scope="col">Policy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.policyId}>
                  <th scope="row">
                    <span className="seats-cell-title">{r.title}</span>
                    <code className="tag">{r.record}</code>
                  </th>
                  <td>{r.who}</td>
                  <td>{r.access}</td>
                  <td><PolicyCell state={r.value} pick={r.pick} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card as="section" labelledBy="tech-h" tone="flat">
        <h2 id="tech-h">Technical details</h2>
        <p className="help">For the people running this prototype. A normal release does not need these.</p>
        <details>
          <summary>Fallback: release in the TideCloak console</summary>
          <ol className="seats-steps">
            <li>
              Open <code className="tag">{CONSOLE_URL}</code> in <strong>your own</strong> browser profile.
            </li>
            <li>Users &rarr; <code className="tag">long</code> &rarr; Role mapping &rarr; Assign role.</li>
            <li>
              Pick the realm role <code className="tag">heir-bank-mai</code> and assign it. TideCloak files a change request
              instead of granting it.
            </li>
            <li>Change requests &rarr; select that request &rarr; Approve, and sign in the Tide window.</li>
            <li>With one seat the threshold is 1, so your approval commits it. (Production: 2 of 3 seats.)</li>
            <li>Long signs out and back in; the role reaches him on his next sign-in.</li>
          </ol>
          <a className="button button-secondary" href={CONSOLE_URL} target="_blank" rel="noopener noreferrer">
            Open the TideCloak console
          </a>
        </details>
        <details>
          <summary>Call log ({log.length})</summary>
          <div className="stack-sm">
            <div className="seats-log-head">
              <p className="help">Every call this page made to TideCloak, newest first, so you can see where a flow stops.</p>
              <button className="button-quiet button-sm" onClick={() => setLog([])}>
                Clear
              </button>
            </div>
            {log.length === 0 ? (
              <p className="muted">No calls yet.</p>
            ) : (
              <pre className="raw-store">
                {log.map((e) => `${e.at}  ${e.step}\n  ${e.method} ${e.url}\n  -> ${e.status}  ${e.body}`).join("\n\n")}
              </pre>
            )}
          </div>
        </details>
      </Card>
    </div>
  );

  return (
    <AppShell
      eyebrow="Independent seats"
      title="Review and approve releases"
      description="Mai's items open only for the person she named, and only after an independent seat approves. Heirloom cannot release anything on its own."
    >
      {/* The gate handles signed-out, loading and wrong-role states. Once a seat session has been seen, the
          page stays mounted through the brief re-initialisation after an enclave approval (see showPage). */}
      {showPage ? page : <AccessGate allow={isSeat}>{null}</AccessGate>}
    </AppShell>
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
      return <p className="loading-line" role="status">Asking TideCloak to grant the role…</p>;
    case "filed":
      return (
        <TideProof
          title="What TideCloak just did"
          live
          lines={[
            state.crId ? (
              <>
                It did not grant the role. It filed request <code className="tag">{state.crId}</code> and holds it until a seat
                approves.
              </>
            ) : (
              "It did not grant the role. It filed a request (its id was not returned: see step 2) and holds it until a seat approves."
            ),
          ]}
        >
          <p className="help">
            HTTP {state.status}
            {state.crId ? ` · id from ${state.via}` : ""}
          </p>
        </TideProof>
      );
    case "conflict":
      return (
        <Callout tone="warning" role="status" title="Already waiting for a seat">
          <p className="seats-result-text">
            HTTP {state.status}: a request for this is already waiting{state.crId ? ` (${state.crId})` : ""}. Approve or deny it
            in step 2.
          </p>
        </Callout>
      );
    case "applied":
      return (
        <Callout tone="danger" role="alert" title="Granted without approval">
          <p>HTTP {state.status}: TideCloak granted the role with no change request. Governance (IGA) may be off on this realm.</p>
        </Callout>
      );
    case "error":
      return (
        <Callout tone="danger" role="alert" title="Refused">
          <p className="seats-result-text">HTTP {state.status}: {state.message}</p>
        </Callout>
      );
  }
}

const CALLOUT_TONE = { approved: "success", pending: "warning", refused: "danger", muted: "info" } as const;

function CardResultView({ result, busy, proof, retry }: { result?: CardResult; busy: boolean; proof?: string[]; retry?: () => void }) {
  if (!result) return null;
  const actions = (retry || result.showConsole) && (
    <div className="actions">
      {retry && (
        <button onClick={retry}>
          <Icon name="key" size={18} />
          Open the Tide enclave
        </button>
      )}
      {result.showConsole && (
        <a className="button button-secondary" href={CONSOLE_URL} target="_blank" rel="noopener noreferrer">
          Approve in the TideCloak console instead
        </a>
      )}
    </div>
  );
  if (result.tone === "approved" && proof) {
    return (
      <TideProof tone="released" live lines={proof}>
        <div className="cluster">
          <StatusChip state="released" label="APPROVED" />
          <span className="help">Committed by TideCloak</span>
        </div>
        <details>
          <summary>Show TideCloak&apos;s reply</summary>
          <pre>{result.text}</pre>
        </details>
      </TideProof>
    );
  }
  // In progress: the Tide window is open or TideCloak is being asked for the request to sign.
  if (busy && result.tone === "pending") {
    return (
      <Callout tone="tide" role="status" live title={result.word}>
        <p className="loading-line">{result.text}</p>
      </Callout>
    );
  }
  return (
    <Callout tone={CALLOUT_TONE[result.tone]} role={result.tone === "refused" ? "alert" : "status"} title={result.word}>
      <p className="seats-result-text">{result.text}</p>
      {actions}
    </Callout>
  );
}

function PolicyCell({ state, pick }: { state: LoadState; pick: "owner" | "heir" }) {
  if (state.kind === "loading") {
    return <span className="muted">Loading…</span>;
  }
  if (state.kind === "error") {
    return (
      <span className="stack-sm">
        <StatusChip state="refused" label="COULD NOT LOAD" />
        <code className="seats-error">{state.message}</code>
      </span>
    );
  }
  return state.data[pick] ? <StatusChip state="sealed" label="SIGNED" /> : <StatusChip state="pending" label="NOT SIGNED YET" />;
}
