"use client";

// One-time setup, run by the first realm admin (notary-duc) while the realm has ONE admin.
// Signs the four record policies of SPEC section 3 with the built-in RelationshipAttestation:1
// contract. The UI gate below is cosmetic: /api/policies and /api/admin-policy check the client
// role tide-realm-admin on the verified token.

import { useCallback, useEffect, useRef, useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import { Models } from "@tideorg/js";
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

type Stored = Record<string, { owner: string | null; heir: string | null } | { error: string }>;
type ButtonState =
  | { state: "idle" }
  | { state: "working" }
  | { state: "signed" }
  | { state: "error"; err: TideErrorClass };

const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

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

export default function SetupPage() {
  const { isInitializing, authenticated, login, hasClientRole, secureFetch, getVendorId, getConfig, baseURL } =
    useTideCloak();
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
    const res = await secureFetch("/api/admin-policy");
    if (res.ok) {
      b64 = ((await res.json()) as { adminPolicy?: unknown }).adminPolicy;
      setAdminPolicySource("via /api/admin-policy (server)");
    } else if (res.status === 501) {
      const realm = String(getConfig().realm ?? "");
      const url = `${baseURL}/admin/realms/${encodeURIComponent(realm)}/iga/role-policies/name/tide-realm-admin`;
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
      const res = await secureFetch(`/api/policies?record=${r}`);
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
      const res = await secureFetch("/api/policies", {
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

  if (isInitializing) return <main style={page}>Loading...</main>;
  if (!authenticated) {
    return (
      <main style={page}>
        <Badge />
        <h1 style={h1}>Setup</h1>
        <button onClick={login} style={btn}>Sign in</button>
      </main>
    );
  }
  if (!isAdmin) {
    return (
      <main style={page}>
        <Badge />
        <h1 style={h1}>Setup</h1>
        <p style={{ color: "var(--refused)", fontWeight: 600 }}>
          <span aria-hidden>✕</span> NOT ALLOWED: this page is for a realm admin (tide-realm-admin) only.
        </p>
      </main>
    );
  }

  return (
    <main style={page}>
      <Badge />
      <h1 style={h1}>Setup: sign the four record policies</h1>
      <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "var(--space-1) var(--space-3)", fontSize: "var(--fs-small)" }}>
        <dt>Models.Policy.latestVersion</dt>
        <dd style={mono}>{latestVersion}</dd>
        <dt>vendorId</dt>
        <dd style={mono}>{vendorId || "(none)"}</dd>
        <dt>Admin policy</dt>
        <dd style={mono}>{adminPolicySource}</dd>
      </dl>

      <section style={card}>
        {POLICIES.map((p) => {
          const s = buttons[p.id] ?? { state: "idle" };
          return (
            <div key={p.id} style={{ padding: "var(--space-2) 0", borderBottom: "1px solid var(--border)" }}>
              <button onClick={() => void sign(p)} disabled={s.state === "working"} style={btn}>
                Sign {p.id}
              </button>{" "}
              <span style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)" }}>
                record {p.recordId}, Role {p.roleId}, {p.access}
              </span>
              <div style={{ marginTop: "var(--space-1)" }}>
                {s.state === "working" && (
                  <span style={{ color: "var(--pending)", fontWeight: 600 }}><span aria-hidden>⧗</span> SIGNING (approve in the enclave)</span>
                )}
                {s.state === "signed" && (
                  <span style={{ color: "var(--approved)", fontWeight: 600 }}><span aria-hidden>✓</span> SIGNED</span>
                )}
                {s.state === "error" && (
                  <div style={{ color: "var(--refused)" }}>
                    <span style={{ fontWeight: 600 }}><span aria-hidden>✕</span> ERROR ({s.err.kind})</span>
                    <pre style={pre}>message: {s.err.message}{"\n"}cause: {s.err.cause || "(none)"}</pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section style={card}>
        <h2 style={h2}>Stored policies</h2>
        <button onClick={() => void loadStored()} style={btnQuiet}>Reload</button>
        {RECORDS.map((r) => {
          const s = stored[r];
          return (
            <div key={r} style={{ marginTop: "var(--space-2)" }}>
              <strong>{r}</strong>
              {!s ? (
                <span style={{ color: "var(--text-muted)" }}> loading...</span>
              ) : "error" in s ? (
                <span style={{ color: "var(--refused)" }}> <span aria-hidden>✕</span> {s.error}</span>
              ) : (
                <ul style={{ margin: 0, fontSize: "var(--fs-small)" }}>
                  {(["owner", "heir"] as const).map((k) => (
                    <li key={k}>
                      {k}:{" "}
                      {s[k] ? (
                        <span style={{ color: "var(--approved)" }}><span aria-hidden>✓</span> STORED <span style={mono}>{s[k]!.slice(0, 24)}...</span></span>
                      ) : (
                        <span style={{ color: "var(--pending)" }}><span aria-hidden>⧗</span> MISSING</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section style={card}>
        <h2 style={h2}>Test refusal</h2>
        <p style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)" }}>
          Decrypts a dummy ciphertext with the heir:mai-bank policy as this admin (who does not hold heir-bank-mai).
          Copy the message and cause below into the markers in src/lib/tide/refusal.ts.
        </p>
        <button onClick={() => void testRefusal()} disabled={!bankHeir} style={btn}>
          Test refusal (mai-bank, heir policy)
        </button>
        {!bankHeir && <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-small)" }}> sign heir:mai-bank first</span>}
        {test && (
          <pre style={pre}>
            {`classifyTideError: ${typeof test.result === "string" ? test.result : JSON.stringify(test.result, null, 2)}\n\nraw message: ${test.message}\nraw cause: ${test.cause}`}
          </pre>
        )}
      </section>
    </main>
  );
}

function Badge() {
  return (
    <span style={{ display: "inline-block", border: "1px dashed var(--mock-border)", color: "var(--mock)", borderRadius: "var(--radius-pill)", padding: "2px 10px", fontSize: "var(--fs-small)", fontWeight: 600 }}>
      SYNTHETIC DATA
    </span>
  );
}

const page: React.CSSProperties = { maxWidth: 820, margin: "0 auto", padding: "var(--space-5) var(--space-3)", color: "var(--text)" };
const h1: React.CSSProperties = { fontFamily: "var(--font-head)", fontSize: "var(--fs-h1)", margin: "var(--space-3) 0" };
const h2: React.CSSProperties = { fontFamily: "var(--font-head)", fontSize: "var(--fs-h2)", margin: "0 0 var(--space-2)" };
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "var(--space-3)", marginTop: "var(--space-4)" };
const btn: React.CSSProperties = { background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: "var(--radius)", padding: "var(--space-2) var(--space-3)", fontSize: "var(--fs-small)", fontWeight: 600, cursor: "pointer" };
const btnQuiet: React.CSSProperties = { ...btn, background: "var(--surface-sunk)", color: "var(--text)" };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", wordBreak: "break-all", margin: 0 };
const pre: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: "var(--fs-small)", background: "var(--surface-sunk)", padding: "var(--space-2)", borderRadius: "var(--radius)", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--text)" };
