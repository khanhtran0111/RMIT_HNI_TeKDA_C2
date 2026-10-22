"use client";

// One-time setup, run by the first realm admin (notary-duc) while the realm has ONE admin.
// Signs the four record policies of SPEC section 3 with the built-in RelationshipAttestation:1
// contract. The UI gate below is cosmetic: /api/policies and /api/admin-policy check the client
// role tide-realm-admin on the verified token.

import { useCallback, useEffect, useRef, useState } from "react";
import { Models } from "@tideorg/js";
import { AccessGate, AppShell } from "@/components/AppShell";
import { useSession } from "@/components/Session";
import { Icon } from "@/components/Icon";
import { StatusChip } from "@/components/StatusChip";
import { Callout, Card, SectionHeader, Term } from "@/components/ui";
import { NodeGrid } from "@/components/tide";
import {
  signRelationshipPolicy,
  decryptForRecord,
  describeRelationshipPolicy,
  type RelationshipAccess,
} from "@/lib/tide/relationship";
import { classifyTideError, type TideErrorClass } from "@/lib/tide/refusal";
import type { PolicyEntry } from "@/lib/policyStore";

// Same table as the server route (SPEC section 3). The server re-checks every field.
const POLICIES: { id: string; recordId: string; roleId: string; access: RelationshipAccess }[] = [
  { id: "owner:mai-care", recordId: "mai-care", roleId: "vault-owner-mai", access: "read-write" },
  { id: "owner:mai-bank", recordId: "mai-bank", roleId: "vault-owner-mai", access: "read-write" },
  { id: "heir:mai-care", recordId: "mai-care", roleId: "heir-care-mai", access: "read" },
  { id: "heir:mai-bank", recordId: "mai-bank", roleId: "heir-bank-mai", access: "read" },
];
const RECORDS = ["mai-care", "mai-bank"] as const;
const RECORD_TITLES: Record<string, string> = { "mai-care": "Care wishes", "mai-bank": "Bank and pension logins" };

type Stored = Record<string, { owner: string | null; heir: string | null } | { error: string }>;
type ButtonState =
  | { state: "idle" }
  | { state: "working" }
  | { state: "signed" }
  | { state: "error"; err: TideErrorClass };

const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// The SDK's secureFetch runs `new URL(url)`, so a relative path throws "Invalid URL".
const abs = (path: string) => new URL(path, window.location.origin).toString();

async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  const e = body?.error;
  if (typeof e === "string") return `${res.status} ${e}`;
  if (e && typeof e === "object") {
    const { code, message } = e as { code?: unknown; message?: unknown };
    return `${res.status} ${String(code ?? "")} ${String(message ?? "")}`.trim();
  }
  return `${res.status} ${res.statusText}`;
}

function rawCause(err: unknown): string {
  const c = (err as { cause?: unknown } | null)?.cause;
  if (c === undefined) return "(no cause)";
  if (typeof c === "string") return c;
  try {
    return JSON.stringify(c, c && typeof c === "object" ? Object.getOwnPropertyNames(c) : undefined);
  } catch {
    return String(c);
  }
}

/** Plain sentence for a policy row: who may do what with which item. */
function policyTitle(p: (typeof POLICIES)[number]): string {
  const item = (RECORD_TITLES[p.recordId] ?? p.recordId).toLowerCase();
  return p.access === "read-write" ? `Mai may read and change the ${item}` : `The holder of ${p.roleId} may read the ${item}`;
}

export default function SetupPage() {
  const session = useSession();
  const { isInitializing, authenticated, hasClientRole, secureFetch, getVendorId, getConfig, baseURL } = session;
  const isAdmin = !isInitializing && authenticated && hasClientRole("tide-realm-admin", "realm-management");

  const latestVersion = String((Models.Policy as unknown as { latestVersion: string }).latestVersion);
  const vendorId = isAdmin ? getVendorId() : "";

  const adminPolicyRef = useRef<Uint8Array | null>(null);
  const [adminPolicySource, setAdminPolicySource] = useState<string>("not fetched yet");
  const [buttons, setButtons] = useState<Record<string, ButtonState>>({});
  const [stored, setStored] = useState<Stored>({});
  const [test, setTest] = useState<{ result: TideErrorClass | string; message: string; cause: string } | null>(null);

  // Admin policy: our server first (forwards the caller's token); on 501 the browser asks TideCloak
  // directly with the SDK's DPoP-aware fetch. Cached so later clicks reach the enclave popup fast.
  const getAdminPolicy = useCallback(async (): Promise<Uint8Array> => {
    if (adminPolicyRef.current) return adminPolicyRef.current;
    let b64: unknown;
    const res = await secureFetch(abs("/api/admin-policy"));
    if (res.ok) {
      b64 = ((await res.json()) as { adminPolicy?: unknown }).adminPolicy;
      setAdminPolicySource("via /api/admin-policy (server)");
    } else if (res.status === 501) {
      const realm = String(getConfig().realm ?? "");
      const url = `${String(baseURL).replace(/\/+$/, "")}/admin/realms/${encodeURIComponent(realm)}/iga/role-policies/name/tide-realm-admin`;
      const direct = await secureFetch(url);
      if (!direct.ok) throw new Error(`TideCloak answered ${direct.status} for the admin policy`);
      b64 = ((await direct.json()) as { policy?: unknown }).policy;
      setAdminPolicySource("from TideCloak in the browser (server got 501)");
    } else {
      throw new Error(`/api/admin-policy: ${await errorText(res)}`);
    }
    if (typeof b64 !== "string" || !b64) throw new Error("admin policy response has no policy");
    adminPolicyRef.current = fromBase64(b64);
    return adminPolicyRef.current;
  }, [secureFetch, getConfig, baseURL]);

  const loadStored = useCallback(async () => {
    const next: Stored = {};
    for (const r of RECORDS) {
      const res = await secureFetch(abs(`/api/policies?record=${r}`));
      next[r] = res.ok ? ((await res.json()) as { owner: string | null; heir: string | null }) : { error: await errorText(res) };
    }
    setStored(next);
  }, [secureFetch]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadStored();
    getAdminPolicy().catch((err) => setAdminPolicySource(`failed: ${classifyTideError(err).message}`));
  }, [isAdmin, loadStored, getAdminPolicy]);

  // Called straight from the click so the enclave popup is not blocked.
  async function sign(p: (typeof POLICIES)[number]) {
    setButtons((b) => ({ ...b, [p.id]: { state: "working" } }));
    try {
      const adminPolicy = await getAdminPolicy();
      const subject = { type: "Role" as const, id: p.roleId };
      const signed = await signRelationshipPolicy(
        { vendorId: getVendorId(), subject, recordId: p.recordId, access: p.access },
        adminPolicy,
      );
      const d = describeRelationshipPolicy(signed);
      if (!d.isRelationshipPolicy || !d.signed || d.recordId !== p.recordId || d.subjectType !== "Role" || d.subjectId !== p.roleId) {
        throw new Error(`signed policy does not match ${p.id}: ${JSON.stringify(d)}`);
      }
      const body: { policyId: string } & PolicyEntry = { policyId: p.id, recordId: p.recordId, subject, access: p.access, policy: signed };
      const res = await secureFetch(abs("/api/policies"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`/api/policies: ${await errorText(res)}`);
      setButtons((b) => ({ ...b, [p.id]: { state: "signed" } }));
      void loadStored();
    } catch (err) {
      setButtons((b) => ({ ...b, [p.id]: { state: "error", err: classifyTideError(err) } }));
    }
  }

  const bankHeir = (() => {
    const s = stored["mai-bank"];
    return s && "heir" in s ? s.heir : null;
  })();

  async function testRefusal() {
    if (!bankHeir) return; // never decrypt without a policy for the record
    setTest(null);
    try {
      const out = await decryptForRecord("AAAA", "mai-bank", bankHeir);
      setTest({ result: `NOT refused: decrypt returned ${JSON.stringify(out)}`, message: "", cause: "" });
    } catch (err) {
      setTest({ result: classifyTideError(err), message: err instanceof Error ? err.message : String(err), cause: rawCause(err) });
    }
  }

  /** Whether the server already stores this policy (from the "Stored policies" read). */
  function isStored(p: (typeof POLICIES)[number]): boolean {
    const s = stored[p.recordId];
    if (!s || "error" in s) return false;
    return !!(p.access === "read-write" ? s.owner : s.heir);
  }

  return (
    <AppShell
      eyebrow="One-time setup"
      title="Sign the record policies"
      description="A one-time step for the first seat, before anyone seals an item. Each policy is a signed rule that tells the Tide network who may open a record."
    >
      <AccessGate allow={session.isSeat}>
        <div className="stack">
          <Callout tone="tide" title="Sign all four while the realm still has one admin">
            <p>
              Each button opens the Tide enclave, where you sign with your own key. Heirloom&apos;s server stores the signed
              policies but cannot change them, and the Tide network checks them on every open.
            </p>
          </Callout>

          <Card as="section" labelledBy="env-h">
            <h2 id="env-h">This environment</h2>
            <dl className="setup-facts">
              <dt>Models.Policy.latestVersion</dt>
              <dd>{latestVersion}</dd>
              <dt>vendorId</dt>
              <dd>{vendorId || "(none)"}</dd>
              <dt>Admin policy</dt>
              <dd>{adminPolicySource}</dd>
            </dl>
          </Card>

          <Card as="section" labelledBy="sign-h">
            <SectionHeader
              id="sign-h"
              eyebrow="Step 1"
              title="Sign the four policies"
              description={
                <>
                  Built-in Tide contract{" "}
                  <Term explain="A ready-made Tide policy contract: it ties one record to one role. Nothing is written or deployed.">
                    RelationshipAttestation:1
                  </Term>
                  . One policy per record and role.
                </>
              }
            />
            <ul className="seats-rows">
              {POLICIES.map((p) => {
                const s = buttons[p.id] ?? { state: "idle" };
                const done = s.state === "signed" || isStored(p);
                return (
                  <li key={p.id}>
                    <div className="seats-row-head">
                      <div className="stack-sm">
                        <h3>{policyTitle(p)}</h3>
                        <div className="seats-meta">
                          <code className="tag">{p.id}</code>
                          <span>
                            Record <code className="tag">{p.recordId}</code>
                          </span>
                          <span>
                            Role <code className="tag">{p.roleId}</code>
                          </span>
                          <span>{p.access}</span>
                        </div>
                      </div>
                      <button className={done ? "button-secondary" : undefined} onClick={() => void sign(p)} disabled={s.state === "working"}>
                        <Icon name="key" size={18} />
                        Sign {p.id}
                      </button>
                    </div>
                    <div aria-live="polite">
                      {s.state === "working" && (
                        <div className="cluster">
                          <StatusChip state="pending" label="SIGNING" />
                          <span className="help">Approve in the Tide enclave window.</span>
                        </div>
                      )}
                      {s.state === "signed" && (
                        <div className="cluster">
                          <StatusChip state="sealed" label="SIGNED" />
                          <span className="help">Signed in the Tide enclave, checked, and stored by the server.</span>
                        </div>
                      )}
                      {s.state === "error" && (
                        <Callout tone="danger" role="alert" title={`Could not sign (${s.err.kind})`}>
                          <pre className="setup-pre">message: {s.err.message}{"\n"}cause: {s.err.cause || "(none)"}</pre>
                        </Callout>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card as="section" labelledBy="stored-h">
            <SectionHeader
              id="stored-h"
              eyebrow="Step 2"
              title="Stored policies"
              description="What Heirloom's server holds for each record right now."
              action={
                <button className="button-secondary button-sm" onClick={() => void loadStored()}>
                  Reload
                </button>
              }
            />
            <ul className="seats-rows">
              {RECORDS.map((r) => {
                const s = stored[r];
                return (
                  <li key={r}>
                    <h3 className="with-icon">
                      {RECORD_TITLES[r]} <code className="tag">{r}</code>
                    </h3>
                    {!s ? (
                      <p className="muted">Loading…</p>
                    ) : "error" in s ? (
                      <Callout tone="danger" role="alert" title="Could not load">
                        <p className="seats-result-text">{s.error}</p>
                      </Callout>
                    ) : (
                      <ul className="setup-stored">
                        {(["owner", "heir"] as const).map((k) => (
                          <li key={k}>
                            <span className="setup-stored-key">{k === "owner" ? "Owner policy" : "Heir policy"}</span>
                            {s[k] ? (
                              <>
                                <StatusChip state="sealed" label="STORED" />
                                <code className="tag">{s[k]!.slice(0, 24)}…</code>
                              </>
                            ) : (
                              <StatusChip state="pending" label="MISSING" />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card as="section" labelledBy="test-h">
            <SectionHeader
              id="test-h"
              eyebrow="Step 3"
              title="Test a refusal"
              description="Decrypts a dummy ciphertext with the heir:mai-bank policy as this admin, who does not hold heir-bank-mai. The Tide network should refuse."
            />
            <div className="stack-sm">
              <div className="actions">
                <button className="button-secondary" onClick={() => void testRefusal()} disabled={!bankHeir}>
                  <Icon name="shieldX" size={18} />
                  Test refusal (mai-bank, heir policy)
                </button>
                {!bankHeir && <span className="help">Sign heir:mai-bank first.</span>}
              </div>
              <p className="help">Copy the message and cause below into the markers in src/lib/tide/refusal.ts.</p>
            </div>
            <div aria-live="polite">
              {test && (
                <div className="stack-sm">
                  {typeof test.result !== "string" && test.result.kind === "refused" && (
                    <NodeGrid state="refused" compact got={test.result.nodes?.got} required={test.result.nodes?.required} />
                  )}
                  <pre className="raw-store">
                    {`classifyTideError: ${typeof test.result === "string" ? test.result : JSON.stringify(test.result, null, 2)}\n\nraw message: ${test.message}\nraw cause: ${test.cause}`}
                  </pre>
                </div>
              )}
            </div>
          </Card>
        </div>
      </AccessGate>
    </AppShell>
  );
}
