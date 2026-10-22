"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AccessGate, AppShell } from "@/components/AppShell";
import { useSession } from "@/components/Session";
import { useApiFetch, errorMessage } from "@/components/VaultData";
import { ItemCard } from "@/components/ItemCard";
import { Icon, type IconName } from "@/components/Icon";
import { Callout, Card, Person, SectionHeader } from "@/components/ui";
import { CompareCard, TIDE_NETWORK, TideProof } from "@/components/tide";
import { Term } from "@/components/Term";
import { apiJson, createVaultClient } from "@/lib/tide/client";
import { tryReleaseToLong } from "@/lib/operator";
import { heirRoleForRecord } from "@/lib/records";
import type { OperatorStore } from "@/lib/store";
import styles from "./operator.module.css";

type DecodedRow = { id: string; contractId?: string; subjectId?: string; subjectType?: string; recordId?: string; roles?: string; signed?: boolean; error?: string };

/** Who answers each attempt on this page. Presentation only: the attempts themselves are unchanged. */
const DECIDERS = {
  tide: { name: "The Tide network", icon: "network" },
  tidecloak: { name: "TideCloak", icon: "key" },
  api: { name: "Heirloom's own API", icon: "server" },
} as const satisfies Record<string, { name: string; icon: IconName }>;
type Decider = keyof typeof DECIDERS;
const ATTEMPTS: { step: 1 | 2 | 3; title: string; decider: Decider }[] = [
  { step: 1, title: "Open a sealed item", decider: "tide" },
  { step: 2, title: "Release an item to Long", decider: "tidecloak" },
  { step: 3, title: "Skip our API's proof check", decider: "api" },
];

export default function OperatorPage() {
  const session = useSession();
  return <AppShell eyebrow="What our server holds" title="Server dump (what Heirloom stores)" description="Every file on Heirloom's server, unedited. Read all of it, then try to use it to open an item or grant access."><AccessGate><OperatorContent key={session.username} /></AccessGate></AppShell>;
}
function OperatorContent() {
  const session = useSession();
  const apiFetch = useApiFetch();
  const [store, setStore] = useState<OperatorStore>();
  const [rows, setRows] = useState<DecodedRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [plainResult, setPlainResult] = useState("");
  const [release, setRelease] = useState<{ message: string; unexpectedSuccess: boolean; status?: number }>();
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const snapshot = await apiJson<OperatorStore>(await apiFetch("/api/operator/store"));
      setStore(snapshot);
      const { describeRelationshipPolicy } = await import("@/tide-integration/relationship");
      setRows(Object.entries(snapshot.files["policies.json"]).map(([id, entry]) => {
        try { return { id, ...describeRelationshipPolicy(entry.policy) }; }
        catch (error) { return { id, error: errorMessage(error) }; }
      }));
    } catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }, [apiFetch]);
  useEffect(() => { load(); }, [load]);
  async function plainProbe() {
    setBusy("plain"); setPlainResult("");
    try {
      const token = await session.getToken();
      // Deliberately plain fetch: the signed-in token alone must not bypass the DPoP check.
      const response = await fetch("/api/items", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
      setPlainResult(response.status === 401 ? "401: the app's own API refused (not Tide)" : `Unexpected ${response.status}: the DPoP refusal has not been demonstrated. Check the API's proof verification before recording.`);
    } catch (error) { setPlainResult(`The app API probe could not complete: ${errorMessage(error)}`); }
    finally { setBusy(null); }
  }
  async function releaseProbe() {
    if (!store || session.isSeat) return;
    setBusy("release"); setRelease(undefined);
    try {
      const config = session.getConfig();
      setRelease(await tryReleaseToLong(apiFetch, { "auth-server-url": config["auth-server-url"], realm: config.realm }, store.demoIds));
    } catch (error) { setRelease({ message: errorMessage(error), unexpectedSuccess: false }); }
    finally { setBusy(null); }
  }
  if (loading) return <p className="loading-line" role="status">Reading everything our server stores…</p>;
  if (error) return <Callout tone="danger" role="alert" title="The server dump could not load"><p>{error}</p><div className="actions"><button className="button-secondary" onClick={load}>Reload</button></div></Callout>;
  if (!store) return null;
  const client = createVaultClient(apiFetch);
  const idsReady = !!store.demoIds.long && !!store.demoIds["heir-bank-mai"];
  const userKey = session.getValueFromToken("tideuserkey");
  const items = store.files["items.json"];
  const policies = store.files["policies.json"];
  const policyCount = Object.keys(policies).length;
  // Presentation only: the 403 is TideCloak's refusal (red); anything else did not demonstrate it (amber).
  const releaseRefused = release?.status === 403;
  const plainRefused = plainResult.startsWith("401");
  // Records whose heir role this session already holds: their items open here, as the rule intends.
  const heldRecords = Object.entries(heirRoleForRecord).filter(([, role]) => session.roles.includes(role)).map(([record]) => record);
  /** Who a decoded policy row is for, read from the stored files only (never guessed from role names). */
  const holder = (row: DecodedRow) => {
    const item = items.find(entry => entry.recordId === row.recordId);
    const access = policies[row.id]?.access;
    if (!item) return undefined;
    if (access === "read-write") return { name: item.ownerUsername, role: "Owner" };
    if (access === "read") return { name: item.recipientUsername, role: "Recipient, once released" };
    return undefined;
  };

  return <div className={`stack-lg ${styles.root}`}>
    <p className={styles.explainer}>
      <span className={styles.explainerLabel}><Icon name="eye" size={18} />What you are looking at</span>
      <span className={styles.explainerText}>Everything Heirloom&apos;s server holds, as an insider would see it. Each item&apos;s content is <Term id="ciphertext">ciphertext</Term>, the signed <Term id="policy">policies</Term> say who may open it, and only the <Term id="tide-network">Tide network</Term> can release a key, never us.</span>
    </p>

    <Card as="section" tone="tide" labelledBy="dump-banner-h">
      <h2 id="dump-banner-h" className="with-icon"><Icon name="server" size={28} />Everything Heirloom stores. No key exists on our side.</h2>
      <p>Below is every file on our server: {items.length} sealed {items.length === 1 ? "item" : "items"} and {policyCount} signed {policyCount === 1 ? "policy" : "policies"}. Use them to try to get in. Each attempt is refused, and each result names who refused it.</p>
      <div className="cluster"><Person name={session.username} role="Your identity for every attempt on this page" /></div>
    </Card>

    <CompareCard title="An ordinary app vs Heirloom on Tide" description="The same copy of this server, in two different products." rows={[
      { label: "A copy of this server", ordinary: "This dump plus one admin account is every family's secrets.", tide: "This dump opens nothing: there is no key on our side." },
      { label: "Opening an item", ordinary: "The server decrypts for whoever it trusts.", tide: `Independent Tide nodes must agree: ${TIDE_NETWORK.required} of ${TIDE_NETWORK.total} on ${TIDE_NETWORK.label}.` },
      { label: "Granting access", ordinary: "One admin changes a permission.", tide: <>Only a <Term id="seat">seat</Term> can, approving in the <Term id="enclave">Tide enclave</Term>.</> },
    ]} />

    <div className="grid-2">
      <section aria-labelledby="dump-files-h">
        <SectionHeader id="dump-files-h" eyebrow="What we hold" title="The raw files" description="Complete and unedited, exactly as our server keeps them." />
        <div className="stack">
          {Object.entries(store.files).map(([name, value]) => {
            const id = `file-${name.replace(/\W+/g, "-")}`;
            return <Card as="section" key={name} labelledBy={id}>
              <h3 id={id} className="with-icon mono"><Icon name="fileText" size={20} />{name}</h3>
              {name === "items.json" && <p className="help">{items.length} {items.length === 1 ? "item" : "items"}. Titles and recipients are readable; the content of each item is <Term id="ciphertext">ciphertext</Term>, sealed in its owner&apos;s browser.</p>}
              {name === "policies.json" && <p className="help">{policyCount} signed <Term id="policy">{policyCount === 1 ? "policy" : "policies"}</Term>: which role may open which record.</p>}
              <pre className="raw-store" tabIndex={0}>{JSON.stringify(value, null, 2)}</pre>
            </Card>;
          })}
          <Card as="aside" tone="sunk" labelledBy="dump-legend-h">
            <h3 id="dump-legend-h" className="with-icon"><Icon name="info" size={20} />How to read these files</h3>
            <p><code className="tag">ciphertext</code> The item itself, scrambled before it left the owner&apos;s browser. The key to open it is held in pieces by the Tide network, never whole and never by us.</p>
            <p><code className="tag">recipientUsername</code> Who the item is for. Naming someone here does not let them open it; only a release by a seat does.</p>
            <p><code className="tag">policy</code> A rule a seat signed at setup. Edit it and the Tide network&apos;s signature check fails.</p>
          </Card>
          <Card>
            <details style={{ marginTop: 0 }}>
              <summary>Public identity references</summary>
              <p className="help">Only public values: your public key and the setup identifiers for this demo. There is no private key here to show.</p>
              <pre className="raw-store" tabIndex={0}>{JSON.stringify({ userKeys: [{ username: session.username, publicKey: typeof userKey === "string" ? userKey : "Not present in this token" }], demoIds: store.demoIds }, null, 2)}</pre>
            </details>
          </Card>
        </div>
      </section>

      <section aria-labelledby="dump-attempts-h">
        <SectionHeader id="dump-attempts-h" eyebrow="Try to use it" title="Attempts" description="Three ways to try to get in with this dump, using your own identity. Three different gatekeepers answer." />
        <div className="stack">
          <div className="stack-sm">
            <p className="help" id="dump-deciders-h" style={{ margin: 0 }}>Who decides each attempt:</p>
            <ol className={styles.deciders} aria-labelledby="dump-deciders-h">
              {ATTEMPTS.map(attempt => <li key={attempt.step}>
                <span className={styles.deciderNum} aria-hidden="true">{attempt.step}</span>
                <span className={styles.deciderWhat}>{attempt.title}</span>
                <DeciderBadge decider={attempt.decider} label={false} />
              </li>)}
            </ol>
          </div>
          <section aria-labelledby="attempt-open-h" className="stack">
            <AttemptHeader attempt={ATTEMPTS[0]} id="attempt-open-h">
              Each item goes to the Tide network with its recipient&apos;s policy, exactly as the recipient would send it. This page adds no check of its own. On {TIDE_NETWORK.label}, {TIDE_NETWORK.required} of {TIDE_NETWORK.total} independent nodes compare the policy with your roles.
            </AttemptHeader>
            {!!heldRecords.length && <Callout tone="warning" title="Your session already holds an heir role">
              <p>You hold the heir role for {heldRecords.map((record, i) => <span key={record}>{i ? " and " : ""}<code className="tag">{record}</code></span>)}, so {heldRecords.length === 1 ? "that record’s item opens" : "those records’ items open"} for you here. That is the release working, not a bypass. To watch a refusal, try an item for another record, or sign in as Mai or her notary.</p>
            </Callout>}
            {!items.length && <div className="empty-state">Nothing is stored yet. Items appear here after Mai seals them in her vault.</div>}
            <div className="item-list">{items.map(item => <ItemCard key={item.id} item={item} access="heir" operator open={() => client.openItem(item, "heir")} />)}</div>
          </section>

          <Card as="section" labelledBy="attempt-release-h">
            <div className="stack">
              <AttemptHeader attempt={ATTEMPTS[1]} id="attempt-release-h">
                Sends <Term id="tidecloak">TideCloak</Term>, Tide&apos;s identity server, the same role grant a seat sends to release Mai&apos;s bank logins. It goes straight from your browser, signed with your own token.
              </AttemptHeader>
              <div className="stack-sm">
                <div className="actions"><button className="button-secondary" disabled={!!busy || !idsReady || session.isSeat} onClick={releaseProbe}><Icon name="send" size={18} />{busy === "release" ? "Calling TideCloak…" : "Try to release to Long"}</button></div>
                {session.isSeat && <p className="help">You hold a seat, so this test is turned off: from your account it would file a real release request. Releases happen on <Link href="/seats">Independent seats</Link>.</p>}
                {!idsReady && <p className="help">This test is unavailable until the server is configured with Long&apos;s account and heir role identifiers. Nothing is guessed.</p>}
                {busy === "release" && <p className="loading-line" role="status">Waiting for TideCloak to answer…</p>}
              </div>
              {release && <div>
                <div className={`result-panel ${releaseRefused ? "result-refused" : "result-outage"}`} role="alert" style={{ marginTop: 0 }}>
                  <div className="refusal-head" style={{ marginBottom: 0 }}>
                    <span className="refusal-icon"><Icon name={releaseRefused ? "shieldX" : "alert"} size={26} /></span>
                    <div>
                      <p className="refusal-kicker">{releaseRefused ? "TideCloak refused" : release.unexpectedSuccess ? "Unexpected result" : "Refusal not demonstrated"}</p>
                      <h3 className="refusal-title">{release.message}</h3>
                    </div>
                  </div>
                </div>
                {releaseRefused && <TideProof title="Who refused" tone="refused" lines={[
                  "TideCloak, Tide's identity server, rejected the role grant: this account is not a seat.",
                  "No role changed. Even a seat's identical request only files a change request: nothing is granted until a seat approves it in the Tide enclave.",
                ]} />}
              </div>}
            </div>
          </Card>

          <Card as="section" labelledBy="attempt-api-h">
            <div className="stack">
              <AttemptHeader attempt={ATTEMPTS[2]} id="attempt-api-h">
                Asks our server for the items with your signed-in token but without its <Term id="dpop">DPoP</Term> proof. An ordinary check, the kind every app has.
              </AttemptHeader>
              <div className="stack-sm">
                <div className="actions"><button className="button-secondary" disabled={!!busy} onClick={plainProbe}><Icon name="server" size={18} />{busy === "plain" ? "Calling our API…" : "Call our API without DPoP"}</button></div>
                {busy === "plain" && <p className="loading-line" role="status">Waiting for our server to answer…</p>}
              </div>
              {plainResult && <div>
                <div className={`result-panel ${plainRefused ? "result-unknown" : "result-outage"}`} role="status" style={{ marginTop: 0 }}>
                  <div className="refusal-head" style={{ marginBottom: 0 }}>
                    <span className="refusal-icon"><Icon name={plainRefused ? "server" : "alert"} size={26} /></span>
                    <div>
                      <p className="refusal-kicker">{plainRefused ? "Heirloom's API refused" : "Refusal not demonstrated"}</p>
                      <h3 className="refusal-title">{plainResult}</h3>
                    </div>
                  </div>
                </div>
                {plainRefused && <div style={{ marginTop: "var(--space-3)" }}><Callout tone="info" icon="server" title="Who refused: Heirloom's own server, not Tide">
                  <p>Our API turned the token away because it arrived without its DPoP proof. This check guards our API. It is not what keeps the items sealed: that is the Tide network, in attempt 1.</p>
                </Callout></div>}
              </div>}
            </div>
          </Card>
        </div>
      </section>
    </div>

    <section aria-labelledby="dump-policies-h" style={{ minWidth: 0 }}>
      <SectionHeader id="dump-policies-h" eyebrow="The rules" title="What the signed policies say" description="Each policy names one record and the one role that may open it. A seat signed them at setup; a changed policy would fail the Tide network's signature check." />
      {!rows.length ? <div className="empty-state">No policies are stored yet. A seat signs them once, on the Setup page.</div> : <div className="table-scroll" style={{ marginBlock: 0 }} role="region" aria-label="Decoded policies (scrolls sideways on small screens)" tabIndex={0}><table style={{ minWidth: 920 }}>
        <caption className="help">Decoded in your browser with Tide&apos;s relationship-policy helper. A recipient holds the heir role only after a seat approves the release.</caption>
        <thead><tr><th scope="col">Policy</th><th scope="col">Record</th><th scope="col">Who may read</th><th scope="col">Access</th><th scope="col">Contract</th><th scope="col">Signature</th></tr></thead>
        <tbody>{rows.map(row => {
          const who = holder(row);
          const access = policies[row.id]?.access;
          return <tr key={row.id}><th scope="row"><code>{row.id}</code></th>{row.error ? <td colSpan={5}>{row.error}</td> : <>
            <td><code className="tag">{row.recordId}</code></td>
            <td><div className="stack-sm"><span><span className="help">{row.subjectType} </span><code className="tag">{row.subjectId}</code></span>{who && <Person name={who.name} role={who.role} size="sm" />}</div></td>
            <td><div className="stack-sm">{access && <span>{access === "read-write" ? "Seal and open" : access === "read" ? "Open only" : access}</span>}<span className="cluster">{tideRoles(row.roles).map(role => <code className="tag" key={role}>{role}</code>)}</span></div></td>
            <td><code>{row.contractId}</code></td>
            <td>{row.signed ? <span className="with-icon"><Icon name="shieldCheck" size={18} />Signed</span> : <span className="with-icon"><Icon name="alert" size={18} />Not signed</span>}</td>
          </>}</tr>;
        })}</tbody>
      </table></div>}
    </section>
  </div>;
}

/** The decoded roles field is a JSON array in a string; show each role on its own. */
function tideRoles(roles?: string): string[] {
  if (!roles) return [];
  try { const parsed: unknown = JSON.parse(roles); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* not JSON: show it as stored */ }
  return [roles];
}

/** Attempt number, title, who decides, and one plain-language line on what the attempt sends. */
function AttemptHeader({ attempt, id, children }: { attempt: (typeof ATTEMPTS)[number]; id: string; children: ReactNode }) {
  return <div>
    <p className="eyebrow">Attempt {attempt.step} of 3</p>
    <h3 id={id}>{attempt.title}</h3>
    <p className={styles.attemptDecider}><DeciderBadge decider={attempt.decider} /></p>
    <p className="help">{children}</p>
  </div>;
}

/** "Who decides: TideCloak" as a pill, toned per gatekeeper (Tide network, TideCloak, our API). */
function DeciderBadge({ decider, label = true }: { decider: Decider; label?: boolean }) {
  const { name, icon } = DECIDERS[decider];
  return <span className={`${styles.decider} ${styles[decider]}`}>
    <Icon name={icon} size={16} />
    {label ? <span className={styles.deciderLabel}>Who decides<span className="sr-only">:</span></span> : <span className="sr-only">Decided by</span>}
    <strong>{name}</strong>
  </span>;
}
