"use client";

import { useRef, useState } from "react";
import { AccessGate, AppShell } from "@/components/AppShell";
import { useSession } from "@/components/Session";
import { ItemCard } from "@/components/ItemCard";
import { RefusalPanel } from "@/components/RefusalPanel";
import { useVaultItems, errorMessage } from "@/components/VaultData";
import { demoFixtures, recordForRecipient, type Fixture } from "@/lib/fixtures";
import type { Recipient } from "@/lib/store";

export default function VaultPage() {
  const session = useSession();
  return <AppShell eyebrow="Mai’s decisions" title="My vault" description="Seal the things your family will need. Choose who each item is for, while the decision is yours."><AccessGate allow={session.roles.includes("vault-owner-mai")}><VaultContent key={`${session.username}:${session.token}`} username={session.username} /></AccessGate></AppShell>;
}
function VaultContent({ username }: { username: string }) {
  const { items, setItems, loading, error, refresh, client } = useVaultItems();
  const [title, setTitle] = useState("");
  const [recipient, setRecipient] = useState<Recipient>("linh");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [sealError, setSealError] = useState<unknown>();
  const [status, setStatus] = useState("");
  const pending = useRef(false);
  const own = items.filter(item => item.ownerUsername === username);
  async function seal(fixtures: Fixture[], clear: boolean) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setSealError(undefined); setStatus("");
    let completed = 0;
    try {
      for (const fixture of fixtures) {
        setStatus(`Sealing ${fixture.title} in your browser…`);
        const item = await client.sealItem(fixture);
        setItems(previous => [...previous, item]); completed++;
      }
      if (clear) { setTitle(""); setContent(""); }
      setStatus(`${completed} ${completed === 1 ? "item sealed" : "items sealed"}. Only ciphertext was sent to Heirloom.`);
    } catch (error) { setSealError(error); setStatus(completed ? `${completed} item sealed before the next item failed.` : "Nothing was sealed."); }
    finally { pending.current = false; setBusy(false); }
  }
  const missingFixtures = demoFixtures.filter(fixture => !own.some(item => item.recordId === fixture.recordId));
  return <div className="workspace-grid"><section aria-label="Sealed items"><div className="section-heading"><h2>Sealed items <span className="muted">({own.length})</span></h2><button className="button-secondary" disabled={busy || loading || !!error || !missingFixtures.length} onClick={() => seal(missingFixtures, false)}>{busy ? "Sealing…" : missingFixtures.length ? "Seal demo items" : "Demo items sealed"}</button></div>
    {loading && <p role="status">Loading your sealed items…</p>}{error && <div className="notice" role="alert"><p>{error}</p><button className="button-secondary" onClick={refresh}>Reload items</button></div>}
    {!loading && !error && !own.length && <div className="empty-state"><h3>Your decisions begin here</h3><p>Seal the two fictional demo items, or write an item for Linh or Long.</p></div>}
    <div className="item-list">{own.map(item => <ItemCard key={item.id} item={item} access="owner" open={() => client.openItem(item, "owner")} />)}</div>
  </section><section className="stack"><form className="seal-form" onSubmit={event => { event.preventDefault(); seal([{ recordId: recordForRecipient[recipient], title, recipientUsername: recipient, content }], true); }}>
    <div><p className="eyebrow">A named recipient</p><h2>Seal an item</h2><p className="help">Content is encrypted in this browser before it is stored.</p></div>
    <div className="field"><label htmlFor="title">Title</label><input id="title" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} disabled={busy} placeholder="What should they know?" /></div>
    <div className="field"><label htmlFor="recipient">Recipient</label><select id="recipient" value={recipient} onChange={event => setRecipient(event.target.value as Recipient)} disabled={busy}><option value="linh">Linh — care wishes</option><option value="long">Long — bank and pension logins</option></select><span className="help">Record: {recordForRecipient[recipient]}</span></div>
    <div className="field"><label htmlFor="content">Content</label><textarea id="content" required rows={7} value={content} onChange={event => setContent(event.target.value)} disabled={busy} placeholder="Use fictional information for this demo." /></div>
    <button disabled={busy || !title.trim() || !content.trim()} type="submit">{busy ? "Sealing in your browser…" : "Seal for " + recipient}</button>
  </form>{status && <p role="status">{status}</p>}{sealError !== undefined && <RefusalPanel error={sealError} />}<p className="help">A release needs 2 of 3 independent seats. Heirloom has no seat.</p></section></div>;
}
