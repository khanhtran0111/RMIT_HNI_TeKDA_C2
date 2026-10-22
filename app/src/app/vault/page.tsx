"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AccessGate, AppShell } from "@/components/AppShell";
import { useSession } from "@/components/Session";
import { ItemCard } from "@/components/ItemCard";
import { RefusalPanel } from "@/components/RefusalPanel";
import { Icon, type IconName } from "@/components/Icon";
import { Term } from "@/components/Term";
import { Callout, Card, Person, SectionHeader, displayName } from "@/components/ui";
import { NodeGrid, TideProof } from "@/components/tide";
import { useVaultItems } from "@/components/VaultData";
import { demoFixtures, recordForRecipient, type Fixture } from "@/lib/fixtures";
import type { Recipient } from "@/lib/store";
import styles from "./vault.module.css";

// Presentation only: a template fills the Title, suggests a recipient and changes the Content
// placeholder and hint. It never writes Content, so nothing private is ever pre-filled.
type TemplateId = "letter" | "passwords" | "care" | "wallet";
const TEMPLATES: { id: TemplateId; label: string; icon: IconName; title: string; recipient: Recipient; placeholder: string; hint: string }[] = [
  {
    id: "letter", label: "Letter", icon: "fileText", title: "A letter for Linh", recipient: "linh",
    placeholder: "SYNTHETIC. Dear Linh,\nIf you are reading this, I can no longer say it myself.\nThank you for the Sunday phone calls…",
    hint: "Write it the way you would say it to her. Fictional details only.",
  },
  {
    id: "passwords", label: "Passwords", icon: "key", title: "Household account logins", recipient: "long",
    placeholder: "SYNTHETIC. Not real accounts.\nWater company: user mai.practice, password PRACTICE-only-1\nPhone plan: PIN 1234 (practice)",
    hint: "One account per line. Practice passwords only, never a real one.",
  },
  {
    id: "care", label: "Care wishes", icon: "user", title: "Daily care routine", recipient: "linh",
    placeholder: "SYNTHETIC. My day (fictional):\nMorning: green tea, then a short walk if it is dry.\nTablets with breakfast.\nThe radio on in the afternoon, please.",
    hint: "Routines, likes and dislikes, and who should decide what. Fictional details only.",
  },
  {
    id: "wallet", label: "Wallet recovery phrase", icon: "lock", title: "Practice wallet recovery phrase", recipient: "long",
    placeholder: "SYNTHETIC: 12 practice words, for example\nlantern meadow pebble violin harbor maple\ncotton orbit puzzle saddle timber velvet\nNever a real recovery phrase.",
    hint: "A real phrase controls real money. Use practice words only.",
  },
];

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
  // Presentation only: the last template chosen, and a short note for screen readers.
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [templateNote, setTemplateNote] = useState("");
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
  // A template stays active while the form holds something; once the form is cleared (after sealing) it lets go.
  const activeTemplate = TEMPLATES.find(t => t.id === template && (title !== "" || content !== ""));
  function applyTemplate(id: TemplateId) {
    const chosen = TEMPLATES.find(t => t.id === id);
    if (!chosen) return;
    // A second press on the active chip turns it off (aria-pressed toggle). What was typed stays.
    if (activeTemplate?.id === id) { setTemplate(null); setTemplateNote(`${chosen.label} template turned off. Your text stays.`); return; }
    setTemplate(id);
    setTitle(chosen.title);
    // Only suggest a recipient the select offers; the record still comes from recordForRecipient.
    const suggested = chosen.recipient in recordForRecipient;
    if (suggested) setRecipient(chosen.recipient);
    setTemplateNote(`${chosen.label} template: title filled in${suggested ? `, recipient set to ${displayName(chosen.recipient)}` : ""}. The content box now suggests what to write.`);
  }
  // Your plan: who the sealed items are for, in the order they were sealed.
  const recipients: { username: string; count: number }[] = [];
  for (const item of own) {
    const found = recipients.find(r => r.username === item.recipientUsername);
    if (found) found.count++; else recipients.push({ username: item.recipientUsername, count: 1 });
  }
  const recipientName = displayName(recipient);
  // Exactly one "Seal demo items" button exists at a time: in the empty state, or in the section header once items exist.
  const demoButton = <button className={demoDone ? "button-secondary" : emptyVault ? "button-lg" : undefined} disabled={busy || loading || !!error || demoDone} onClick={sealDemo}><Icon name={demoDone ? "check" : "lock"} size={18} />{busy ? "Sealing…" : demoDone ? "Demo items sealed" : demoLabel}</button>;
  function result(here: "demo" | "form") {
    const mine = origin === here;
    const spacing = here === "demo" ? { marginBottom: "var(--space-4)" } : { marginTop: "var(--space-3)" };
    const message = !mine || !status ? null : justSealed
      ? <>
          <p className="with-icon" style={{ margin: 0, color: "var(--approved)", fontWeight: 600 }}><Icon name="check" size={20} />{status}</p>
          <TideProof tone="sealed" lines={[
            <>Sealed in your browser. Heirloom’s server received the content only as <Term id="ciphertext">ciphertext</Term>; it sees just the title and who it is for.</>,
            <>Apart from you, only the named recipient can open it, and only after a <Term id="seat">seat</Term> releases it.</>,
          ]} />
        </>
      : <p className="help with-icon" style={{ margin: 0 }}><Icon name={busy ? "lock" : "alert"} size={18} />{status}</p>;
    return <>
      <div aria-live="polite">{message && <div style={spacing}>{message}</div>}</div>
      {mine && sealError !== undefined && <div style={here === "demo" ? { marginBottom: "var(--space-4)" } : undefined}><RefusalPanel error={sealError} action="seal" /></div>}
    </>;
  }
  return <div className={styles.page}>
    <Card as="section" labelledBy="plan-h" className={styles.plan}>
      <div className={styles.planHead}>
        <div><p className="eyebrow">At a glance</p><h2 id="plan-h">Your plan</h2></div>
        <p className={styles.planNote}>Heirloom’s server keeps every item only as <Term id="ciphertext">ciphertext</Term>. It can neither read nor release anything.</p>
      </div>
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt><Icon name="lock" size={16} />Items sealed</dt>
          <dd>{loading
            ? <span className={styles.numberNote}>Loading…</span>
            : error
              ? <span className={styles.numberNote}>Not available</span>
              : <><span className={styles.number}>{own.length}</span><span className={styles.numberNote}>{own.length ? "Encrypted in this browser" : "Nothing sealed yet"}</span></>}</dd>
        </div>
        <div className={styles.stat}>
          <dt><Icon name="users" size={16} />Recipients</dt>
          <dd>{!loading && !error && recipients.length
            ? <ul className={styles.people}>{recipients.map(r => <li key={r.username}><Person name={r.username} role={`${r.count} ${r.count === 1 ? "item" : "items"}`} size="sm" /></li>)}</ul>
            : <span className={styles.numberNote}>{loading ? "Loading…" : error ? "Not available" : "No one yet"}</span>}</dd>
        </div>
        <div className={styles.stat}>
          <dt><Icon name="scale" size={16} />Release needs</dt>
          <dd><span className={styles.rule}>1 <Term id="seat">seat</Term> in this prototype</span><span className={styles.ruleNote}>(2 of 3 in production). Here the seat is Notary Duc.</span></dd>
        </div>
      </dl>
    </Card>
    <div className="workspace-grid">
    <section aria-labelledby="sealed-items-h" style={{ minWidth: 0 }}>
      <SectionHeader id="sealed-items-h" eyebrow="Sealed by you" title={<>Sealed items{!loading && !error && <span className="muted"> ({own.length})</span>}</>} description="You can open any item to check it. The encrypted block on each card is all Heirloom’s server stores." action={own.length ? demoButton : undefined} />
      {result("demo")}
      {loading && <p role="status" className="help">Loading your sealed items…</p>}
      {error && <Callout tone="danger" role="alert" title="Your items could not be loaded"><p>{error}</p><div className="actions"><button className="button-secondary" onClick={refresh}>Reload items</button></div></Callout>}
      {emptyVault && <div className="empty-state">
        <h3 className="with-icon"><Icon name="lock" size={22} />Nothing sealed yet</h3>
        <p>Start with two fictional items: care wishes for Linh, and bank and pension logins for Long. Each one is encrypted in this browser before anything is sent.</p>
        <div className="actions">{demoButton}</div>
        <p className="help" style={{ marginTop: "var(--space-3)" }}>Or write your own item with the form on this page. A template can get you started.</p>
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
        <div className={styles.templates}>
          <p id="template-label" className={styles.groupLabel}>Start from a template <span className="muted">(optional)</span></p>
          <div className={styles.chips} role="group" aria-labelledby="template-label" aria-describedby="template-help">
            {TEMPLATES.map(t => <button key={t.id} type="button" className={styles.chip} aria-pressed={template === t.id && activeTemplate !== undefined} disabled={busy} onClick={() => applyTemplate(t.id)}><Icon name={template === t.id && activeTemplate ? "check" : t.icon} size={16} className={styles.chipIcon} />{t.label}</button>)}
          </div>
          <span id="template-help" className="help">Fills in a title and suggests who it is for and what to write. You can change everything.</span>
          <span className="sr-only" aria-live="polite">{templateNote}</span>
        </div>
        <div className="field"><label htmlFor="title">Title</label><input id="title" aria-describedby="title-help" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} disabled={busy} placeholder="Where the house papers are" /><span id="title-help" className="help">Shown on the card so the right person can find it. Titles are not encrypted, so keep private details in the content.</span></div>
        <div className="field"><label htmlFor="recipient">Recipient</label><select id="recipient" aria-describedby="recipient-help" value={recipient} onChange={event => setRecipient(event.target.value as Recipient)} disabled={busy}><option value="linh">Linh (care wishes)</option><option value="long">Long (bank and pension logins)</option></select><span id="recipient-help" className="help">Each item is for one person. Filed under record <code className="tag">{recordForRecipient[recipient]}</code>.</span></div>
        <div className="field"><label htmlFor="content">Content</label><textarea id="content" aria-describedby="content-help" required rows={7} value={content} onChange={event => setContent(event.target.value)} disabled={busy} placeholder={activeTemplate?.placeholder ?? "What should they know?"} /><span id="content-help" className="help">{activeTemplate ? activeTemplate.hint : "Use fictional details only."} This demo holds synthetic data.</span></div>
        <button className="button-block" disabled={busy || !title.trim() || !content.trim()} type="submit"><Icon name="lock" size={18} />{busy ? "Sealing in your browser…" : <span>Seal for <span style={{ textTransform: "capitalize" }}>{recipient}</span></span>}</button>
        <p className={styles.summary}><Icon name="key" size={18} className={styles.summaryIcon} /><span>Only <strong>{recipientName}</strong> will be able to open this, after a <Term id="seat">seat</Term> approves. You can open it too. Heirloom never can.</span></p>
      </form>
      {result("form")}
      <div style={{ marginTop: "var(--space-4)" }}>
        <Card as="section" labelledBy="release-h">
          <div className="stack">
            <div><p className="eyebrow">What happens next</p><h2 id="release-h" style={{ margin: 0 }}>How an item reaches its person</h2></div>
            <ol className="vault-rules">
              <li><strong>1. You seal it</strong>It is encrypted in this browser. Heirloom’s server keeps the content only as <Term id="ciphertext">ciphertext</Term>.</li>
              <li><strong>2. A <Term id="seat">seat</Term> releases it</strong>An independent approver you chose (here, Notary Duc) signs the release with Tide. Heirloom cannot approve it.</li>
              <li><strong>3. Only the named person opens it</strong>The Tide network checks their role before any key is released. Heirloom holds no such role, so it is refused.</li>
            </ol>
            <NodeGrid state="idle" compact />
            <p className="help">This demo has one seat, so one approval releases an item. In production, 2 of 3 independent seats must agree.</p>
            <div><Link className="button button-quiet" href="/operator">See what Heirloom’s server holds<Icon name="arrowRight" size={18} /></Link></div>
          </div>
        </Card>
      </div>
    </div>
    </div>
  </div>;
}
