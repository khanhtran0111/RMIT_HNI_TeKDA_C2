"use client";

import { useCallback, useEffect, useState } from "react";
import { AccessGate, AppShell } from "@/components/AppShell";
import { useSession } from "@/components/Session";
import { useApiFetch, errorMessage } from "@/components/VaultData";
import { ItemCard } from "@/components/ItemCard";
import { apiJson, createVaultClient } from "@/lib/tide/client";
import { tryReleaseToLong } from "@/lib/operator";
import type { OperatorStore } from "@/lib/store";

type DecodedRow = { id: string; contractId?: string; subjectId?: string; subjectType?: string; recordId?: string; roles?: string; signed?: boolean; error?: string };

export default function OperatorPage() {
  const session = useSession();
  return <AppShell eyebrow="The company’s view" title="Everything Heirloom stores" description="The operator holds every stored byte and every signed policy. Try the same open request as a recipient, using the operator’s own identity."><AccessGate allow={session.roles.includes("operator")}><OperatorContent key={`${session.username}:${session.token}`} /></AccessGate></AppShell>;
}
function OperatorContent() {
  const session = useSession();
  const apiFetch = useApiFetch();
  const [store, setStore] = useState<OperatorStore>();
  const [rows, setRows] = useState<DecodedRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [plainResult, setPlainResult] = useState("");
  const [release, setRelease] = useState<{ message: string; unexpectedSuccess: boolean }>();
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
      setPlainResult(response.status === 401 ? "401: the app's own API refused (not Tide)" : `Unexpected ${response.status}: the DPoP refusal has not been demonstrated. Report to Dev A.`);
    } catch (error) { setPlainResult(`The app API probe could not complete: ${errorMessage(error)}`); }
    finally { setBusy(null); }
  }
  async function releaseProbe() {
    if (!store) return;
    setBusy("release"); setRelease(undefined);
    try {
      const config = session.getConfig();
      setRelease(await tryReleaseToLong(apiFetch, { "auth-server-url": config["auth-server-url"], realm: config.realm }, store.demoIds));
    } catch (error) { setRelease({ message: errorMessage(error), unexpectedSuccess: false }); }
    finally { setBusy(null); }
  }
  if (loading) return <p role="status">Reading the operator’s store…</p>;
  if (error) return <div className="notice" role="alert"><p>{error}</p><button className="button-secondary" onClick={load}>Reload store</button></div>;
  if (!store) return null;
  const client = createVaultClient(apiFetch);
  const idsReady = !!store.demoIds.long && !!store.demoIds["heir-bank-mai"];
  const userKey = session.getValueFromToken("tideuserkey");
  return <div className="stack">
    <section><div className="section-heading"><h2>Try to open the sealed items</h2><span className="help">Identity: {session.username}</span></div><p className="muted">No role check blocks these open buttons. Each attempt goes to the Tide network with the item’s heir policy.</p>
      {!store.files["items.json"].length && <div className="empty-state">No ciphertext is stored yet. Mai must seal the demo items first.</div>}
      <div className="item-list">{store.files["items.json"].map(item => <ItemCard key={item.id} item={item} access="heir" operator open={() => client.openItem(item, "heir")} />)}</div>
    </section>
    <section className="operator-evidence"><h2>Can the company release an item?</h2><p>Send the same role grant a seat would send, directly to TideCloak with the operator’s DPoP token.</p><button className="button-secondary" disabled={!!busy || !idsReady} onClick={releaseProbe}>{busy === "release" ? "Calling TideCloak…" : "Try to release to Long"}</button>{!idsReady && <p className="help">Waiting for Dev A’s demo-ids.json. No identities are guessed.</p>}{release && <div className={`result-panel ${release.unexpectedSuccess ? "result-refused" : "result-unknown"}`} role="alert"><h3>{release.message}</h3></div>}</section>
    <section className="operator-evidence"><h2>The app also checks its own API</h2><p>A signed-in token without its DPoP proof must receive 401. This is a separate check from a Tide network refusal.</p><button className="button-secondary" disabled={!!busy} onClick={plainProbe}>{busy === "plain" ? "Calling our API…" : "Call our API without DPoP"}</button>{plainResult && <p className="notice" role="status">{plainResult}</p>}</section>
    <section><h2>The raw store</h2><p className="muted">These are the complete stored item and policy files. They contain no item plaintext or private encryption keys.</p><div className="raw-grid">{Object.entries(store.files).map(([name, value]) => <section key={name}><h3>{name}</h3><pre className="raw-store">{JSON.stringify(value, null, 2)}</pre></section>)}</div></section>
    <section><h2>What the signed policies say</h2>{!rows.length ? <p className="muted">No policies stored yet. A seat must sign the four policies on /setup.</p> : <div className="table-scroll"><table><caption className="help">Decoded with the Tide relationship-policy helper</caption><thead><tr><th scope="col">Policy</th><th scope="col">Contract</th><th scope="col">Record</th><th scope="col">Subject</th><th scope="col">Operations</th><th scope="col">Signed</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><th scope="row"><code>{row.id}</code></th>{row.error ? <td colSpan={5}>{row.error}</td> : <><td><code>{row.contractId}</code></td><td><code>{row.recordId}</code></td><td>{row.subjectType}: <code>{row.subjectId}</code></td><td><code>{row.roles}</code></td><td>{row.signed ? "✓ SIGNED" : "! UNSIGNED"}</td></>}</tr>)}</tbody></table></div>}</section>
    <section><h2>Public identity references</h2><p className="help">Available public keys and setup identifiers; private keys stay in the Tide enclave.</p><pre className="raw-store">{JSON.stringify({ userKeys: [{ username: session.username, publicKey: typeof userKey === "string" ? userKey : "Not present in this token" }], demoIds: store.demoIds }, null, 2)}</pre></section>
  </div>;
}
