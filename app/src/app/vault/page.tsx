"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AccessGate, AppShell } from "@/components/AppShell";
import { useSession } from "@/components/Session";
import { ItemCard } from "@/components/ItemCard";
import { RefusalPanel } from "@/components/RefusalPanel";
import { Icon } from "@/components/Icon";
import { Callout, Card, SectionHeader, Term, displayName } from "@/components/ui";
import { NodeGrid, TideProof } from "@/components/tide";
import { useVaultItems } from "@/components/VaultData";
import { demoFixtures, recordForRecipient, type Fixture } from "@/lib/fixtures";
import type { Recipient } from "@/lib/store";

const SEAT = "An independent approver, such as a notary, who must agree before anything is released. Heirloom is never a seat.";
const CIPHERTEXT = "Scrambled data that cannot be read without the key.";

export default function VaultPage() {
  const session = useSession();
  return <AppShell eyebrow="Mai’s decisions" title="My vault" description="Seal what your family will need later. Each item is for one person you name, and they can open it only after an independent approver releases it."><AccessGate allow={session.roles.includes("vault-owner-mai")}><VaultContent key={session.username} username={session.username} /></AccessGate></AppShell>;
}
function VaultContent({ username }: { username: string }) {
  const { items, setItems, loading, error, refresh, client } = useVaultItems();
  const [title, setTitle] = useState("");
  const [recipient, setRecipient] = useState<Recipient>("linh");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [sealError, setSealError] = useState<unknown>();
  const [status, setStatus] = useState("");
  // Presentation only: the seal result is shown next to the control that started it.
  const [origin, setOrigin] = useState<"demo" | "form">("demo");
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
      setStatus(`${completed} ${completed === 1 ? "item sealed" : "items sealed"}.`);
    } catch (error) { setSealError(error); setStatus(completed ? `${completed} item sealed before the next item failed.` : "Nothing was sealed."); }
    finally { pending.current = false; setBusy(false); }
  }
  const missingFixtures = demoFixtures.filter(fixture => !own.some(item => item.recordId === fixture.recordId));
  const demoDone = !missingFixtures.length;
  const demoLabel = missingFixtures.length === demoFixtures.length ? "Seal demo items" : missingFixtures.length === 1 ? "Seal the remaining demo item" : "Seal the remaining demo items";
  const emptyVault = !loading && !error && !own.length;
  const justSealed = !busy && sealError === undefined && status !== "";
  function sealDemo() { if (!pending.current) setOrigin("demo"); seal(missingFixtures, false); }
  function sealOwn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending.current) setOrigin("form");
    seal([{ recordId: recordForRecipient[recipient], title, recipientUsername: recipient, content }], true);
  }
  // Exactly one "Seal demo items" button exists at a time: in the empty state, or in the section header once items exist.
  const demoButton = <button className={demoDone ? "button-secondary" : emptyVault ? "button-lg" : undefined} disabled={busy || loading || !!error || demoDone} onClick={sealDemo}><Icon name={demoDone ? "check" : "lock"} size={18} />{busy ? "Sealing…" : demoDone ? "Demo items sealed" : demoLabel}</button>;
  function result(here: "demo" | "form") {
    const mine = origin === here;
    const spacing = here === "demo" ? { marginBottom: "var(--space-4)" } : { marginTop: "var(--space-3)" };
    const message = !mine || !status ? null : justSealed
      ? <>
          <p className="with-icon" style={{ margin: 0, color: "var(--approved)", fontWeight: 600 }}><Icon name="check" size={20} />{status}</p>
          <TideProof tone="sealed" lines={[
            <>Sealed in your browser. Heirloom’s server received the content only as <Term explain={CIPHERTEXT}>ciphertext</Term>; it sees just the title and who it is for.</>,
            <>Apart from you, only the named recipient can open it, and only after a <Term explain={SEAT}>seat</Term> releases it.</>,
          ]} />
        </>
      : <p className="help with-icon" style={{ margin: 0 }}><Icon name={busy ? "lock" : "alert"} size={18} />{status}</p>;
    return <>
      <div aria-live="polite">{message && <div style={spacing}>{message}</div>}</div>
      {mine && sealError !== undefined && <div style={here === "demo" ? { marginBottom: "var(--space-4)" } : undefined}><RefusalPanel error={sealError} action="seal" /></div>}
    </>;
  }
  return <div className="workspace-grid">
    <section aria-labelledby="sealed-items-h" style={{ minWidth: 0 }}>
      <SectionHeader id="sealed-items-h" eyebrow="Sealed by you" title={<>Sealed items{!loading && !error && <span className="muted"> ({own.length})</span>}</>} description="You can open any item to check it. The encrypted block on each card is all Heirloom’s server stores." action={own.length ? demoButton : undefined} />
      {result("demo")}
      {loading && <p role="status" className="help">Loading your sealed items…</p>}
      {error && <Callout tone="danger" role="alert" title="Your items could not be loaded"><p>{error}</p><div className="actions"><button className="button-secondary" onClick={refresh}>Reload items</button></div></Callout>}
      {emptyVault && <div className="empty-state">
        <h3 className="with-icon"><Icon name="lock" size={22} />Nothing sealed yet</h3>
        <p>Start with two fictional items: care wishes for Linh, and bank and pension logins for Long. Each one is encrypted in this browser before anything is sent.</p>
        <div className="actions">{demoButton}</div>
        <p className="help" style={{ marginTop: "var(--space-3)" }}>Or write your own item with the form on this page.</p>
      </div>}
      <div className="item-list">{own.map(item => <ItemCard key={item.id} item={item} access="owner" open={() => client.openItem(item, "owner")} />)}</div>
    </section>
    <div style={{ minWidth: 0 }}>
      <form className="seal-form" aria-labelledby="seal-form-h" onSubmit={sealOwn}>
        <div>
          <p className="eyebrow">Write your own</p>
          <h2 id="seal-form-h">Seal a new item</h2>
          <p className="help">Choose who it is for. The content is encrypted in this browser before anything is sent.</p>
        </div>
        <div className="field"><label htmlFor="title">Title</label><input id="title" aria-describedby="title-help" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} disabled={busy} placeholder="Where the house papers are" /><span id="title-help" className="help">Shown on the card so the right person can find it. Titles are not encrypted, so keep private details in the content.</span></div>
        <div className="field"><label htmlFor="recipient">Recipient</label><select id="recipient" aria-describedby="recipient-help" value={recipient} onChange={event => setRecipient(event.target.value as Recipient)} disabled={busy}><option value="linh">Linh (care wishes)</option><option value="long">Long (bank and pension logins)</option></select><span id="recipient-help" className="help">Apart from you, only {displayName(recipient)} can open it, and only after release. Filed under record <code className="tag">{recordForRecipient[recipient]}</code>.</span></div>
        <div className="field"><label htmlFor="content">Content</label><textarea id="content" aria-describedby="content-help" required rows={7} value={content} onChange={event => setContent(event.target.value)} disabled={busy} placeholder="What should they know?" /><span id="content-help" className="help">Use fictional details only. This demo holds synthetic data.</span></div>
        <button className="button-block" disabled={busy || !title.trim() || !content.trim()} type="submit"><Icon name="lock" size={18} />{busy ? "Sealing in your browser…" : <span>Seal for <span style={{ textTransform: "capitalize" }}>{recipient}</span></span>}</button>
      </form>
      {result("form")}
      <div style={{ marginTop: "var(--space-4)" }}>
        <Card as="section" labelledBy="release-h">
          <div className="stack">
            <div><p className="eyebrow">What happens next</p><h2 id="release-h" style={{ margin: 0 }}>How an item reaches its person</h2></div>
            <ol className="vault-rules">
              <li><strong>1. You seal it</strong>It is encrypted in this browser. Heirloom’s server keeps the content only as <Term explain={CIPHERTEXT}>ciphertext</Term>.</li>
              <li><strong>2. A <Term explain={SEAT}>seat</Term> releases it</strong>An independent approver you chose (here, Notary Duc) signs the release with Tide. Heirloom cannot approve it.</li>
              <li><strong>3. Only the named person opens it</strong>The Tide network checks their role before any key is released. Heirloom holds no such role, so it is refused.</li>
            </ol>
            <NodeGrid state="idle" compact />
            <p className="help">This demo has one seat, so one approval releases an item. In production, 2 of 3 independent seats must agree.</p>
            <div><Link className="button button-quiet" href="/operator">See what Heirloom’s server holds<Icon name="arrowRight" size={18} /></Link></div>
          </div>
        </Card>
      </div>
    </div>
  </div>;
}
