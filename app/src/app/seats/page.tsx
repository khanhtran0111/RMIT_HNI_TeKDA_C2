"use client";

// /seats, slice 1 (SPEC section 5): the rules of the vault, the three seats, and the exact steps to
// release an item in the TideCloak console. Slice 2 (in-app approve via the enclave) is not here.
//
// The role check below is UI gating only. TideCloak itself refuses a role grant from anyone who is
// not a realm admin, and our API checks the token on every route.

import { useCallback, useEffect, useRef, useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";

const CONSOLE_URL = "http://localhost:8080/admin/heirloom/console/";
const SEAT_ROLE = "tide-realm-admin";
const SEAT_ROLE_CLIENT = "realm-management";

type RecordId = "mai-care" | "mai-bank";
type PolicyPair = { owner: string | null; heir: string | null };
type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; data: PolicyPair }
  | { kind: "error"; message: string };

const RECORDS: { id: RecordId; title: string; heirRole: string; heirName: string }[] = [
  { id: "mai-care", title: "Care wishes", heirRole: "heir-care-mai", heirName: "Linh" },
  { id: "mai-bank", title: "Bank and pension logins", heirRole: "heir-bank-mai", heirName: "Long" },
];

const SEATS = [
  { name: "Dr Hanh", what: "family doctor", username: "dr-hanh" },
  { name: "Notary Duc", what: "Mai's notary", username: "notary-duc" },
  { name: "Thu", what: "Mai's friend", username: "thu" },
];

export default function SeatsPage() {
  const { authenticated, isInitializing, login, getValueFromToken, getValueFromIdToken, secureFetch } =
    useTideCloak();

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

  // The context hands out a new secureFetch whenever its memo recomputes (token refresh etc.).
  // Keep the latest one in a ref so the load does not re-run on every refresh.
  const fetchRef = useRef(secureFetch);
  fetchRef.current = secureFetch;

  const loadPolicies = useCallback(async () => {
    for (const rec of RECORDS) {
      setPolicies((p) => ({ ...p, [rec.id]: { kind: "loading" } }));
      try {
        // secureFetch attaches `Authorization: DPoP <token>` + a DPoP proof when no Authorization
        // header is set. It needs an absolute URL (it builds the proof's htu with new URL()).
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

  useEffect(() => {
    if (authenticated && isSeat) loadPolicies();
  }, [authenticated, isSeat, loadPolicies]);

  if (isInitializing) {
    return (
      <Shell>
        <StateLine tone="muted" icon={<IconClock />} word="Loading" text="Checking your sign-in." />
      </Shell>
    );
  }

  if (!authenticated) {
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

  if (!isSeat) {
    return (
      <Shell>
        <h1 style={h1}>Seats</h1>
        <StateLine
          tone="refused"
          icon={<IconX />}
          word="Not a seat"
          text={`${username || "This account"} does not hold ${SEAT_ROLE}. Only the three seats see this page. Sign out and in again if you were just made a seat.`}
        />
        <a href="/" style={btnSecondary}>
          Back to start
        </a>
      </Shell>
    );
  }

  const rows: { policyId: string; record: RecordId; who: string; access: string; value: LoadState; pick: "owner" | "heir" }[] =
    RECORDS.flatMap((rec) => [
      { policyId: `owner:${rec.id}`, record: rec.id, who: "Mai (role vault-owner-mai)", access: "read-write", value: policies[rec.id], pick: "owner" as const },
      { policyId: `heir:${rec.id}`, record: rec.id, who: `whoever holds ${rec.heirRole} (${rec.heirName}, after release)`, access: "read", value: policies[rec.id], pick: "heir" as const },
    ]);

  return (
    <Shell>
      <h1 style={h1}>Seats</h1>
      <StateLine tone="approved" icon={<IconCheck />} word="Seat" text={`Signed in as ${username}. You hold one of the three seats.`} />

      <section style={card}>
        <h2 style={h2}>The rule</h2>
        <p style={{ margin: 0, fontSize: "var(--fs-body)" }}>
          Releasing an item needs <strong>2 of 3 seats</strong>: Dr Hanh (family doctor), Notary Duc, Thu (Mai&apos;s friend).
          Heirloom is not a seat.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: "var(--space-3) 0 0", display: "grid", gap: "var(--space-2)" }}>
          {SEATS.map((s) => (
            <li key={s.username} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ color: "var(--approved)", display: "inline-flex" }}><IconSeat /></span>
              <strong>{s.name}</strong>
              <span style={{ color: "var(--text-muted)" }}>{s.what}</span>
              <code style={mono}>{s.username}</code>
            </li>
          ))}
          <li style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ color: "var(--refused)", display: "inline-flex" }}><IconX /></span>
            <strong>Heirloom Pty Ltd</strong>
            <span style={{ color: "var(--text-muted)" }}>runs the server: no seat</span>
          </li>
        </ul>
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
        <h2 style={h2}>Release an item (TideCloak console)</h2>
        <ol style={{ margin: 0, paddingLeft: "1.4em", display: "grid", gap: "var(--space-2)" }}>
          <li>
            Open <code style={mono}>{CONSOLE_URL}</code> in <strong>your own</strong> browser profile.
          </li>
          <li>Users &rarr; <code style={mono}>long</code>.</li>
          <li>Role mapping &rarr; Assign role.</li>
          <li>
            Pick the realm role <code style={mono}>heir-bank-mai</code> and assign it. TideCloak files a change request
            instead of granting it.
          </li>
          <li>Change requests &rarr; select that request &rarr; Approve.</li>
          <li>Sign in the Tide window that opens. The request now reads <strong>Pending 1 of 2</strong>.</li>
          <li>
            A second seat must approve the same request, in their own profile (steps 5 and 6). Then it commits.
          </li>
          <li>Long signs out and back in; the role reaches him on his next sign-in.</li>
        </ol>
        <p style={{ margin: "var(--space-3) 0 0", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
          For the care wishes: user <code style={mono}>linh</code>, role <code style={mono}>heir-care-mai</code>.
        </p>
        <a href={CONSOLE_URL} target="_blank" rel="noopener noreferrer" style={{ ...btnPrimary, marginTop: "var(--space-4)" }}>
          Open Change Requests
        </a>
      </section>
    </Shell>
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
        maxWidth: 880,
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
        alignItems: "center",
        gap: "var(--space-3)",
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
      <span>{text}</span>
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
const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: "0.9em", wordBreak: "break-all" };
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
