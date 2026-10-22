"use client";

import { useState } from "react";
import { AccessSummary, type AccessState } from "./AccessSummary";
import { RefusalPanel } from "./RefusalPanel";
import { StatusChip } from "./StatusChip";
import { Icon } from "./Icon";
import { Callout, CipherBlock, PlainPanel, Person, displayName } from "./ui";
import { NodeGrid, TIDE_NETWORK, TideProof } from "./tide";
import type { Item } from "@/lib/store";

export function ItemCard({ item, access, released = false, open, operator = false, otherRecipient = false }: { item: Item; access: "owner" | "heir"; released?: boolean; open: () => Promise<string>; operator?: boolean; otherRecipient?: boolean }) {
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState(false);
  const state = busy ? "pending" : access === "heir" && (plaintext !== null || released) ? "released" : "sealed";
  async function handleOpen() {
    setBusy(true); setError(undefined); setPlaintext(null);
    try { setPlaintext(await open()); }
    catch (error) { setError(error); }
    finally { setBusy(false); }
  }
  const primaryOpen = access === "heir" && !operator && !otherRecipient;
  const proofLines = access === "owner"
    ? ["The Tide network checked this item’s owner policy and confirmed your role.", "Decrypted here, in your browser. Heirloom’s server still holds the content only as ciphertext."]
    : ["Released: the Tide network confirmed you now hold the heir role for this item.", "Decrypted here, in your browser. Heirloom’s server still holds the content only as ciphertext."];
  // "Who can open this?" follows the recipient's path. While a request is in flight it keeps the last
  // known step (busy clears error and plaintext); the owner's own reads never count as "Opened".
  const accessState: AccessState = error !== undefined ? "refused"
    : access === "heir" && plaintext !== null ? "opened"
    : access === "heir" && released ? "released"
    : "sealed";
  return <article className={`item${state === "released" ? " item-released" : ""}`} aria-busy={busy || undefined}>
    <div className="item-heading">
      <div className="item-title"><span className="item-icon" aria-hidden="true"><Icon name={state === "released" ? "unlock" : "lock"} size={20} /></span><h3>{item.title}</h3></div>
      <StatusChip state={state} label={busy ? "OPENING" : released && plaintext === null ? "RELEASED TO ME" : undefined} />
    </div>
    <div className="item-meta">
      <span className="person">From <Person name={item.ownerUsername} size="sm" /></span>
      <span className="person">For <Person name={item.recipientUsername} size="sm" /></span>
      <span>Record <code>{item.recordId}</code></span>
      <time dateTime={item.createdAt}>{new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.createdAt))}</time>
    </div>
    {!operator && <AccessSummary recipientName={displayName(item.recipientUsername)} ownerName={displayName(item.ownerUsername)} state={accessState} isOwnerView={access === "owner"} isRecipientView={access === "heir" && !otherRecipient} />}
    {otherRecipient && <p className="help item-note">Addressed to {displayName(item.recipientUsername)}. Opening sends the same request to the Tide network so it can enforce the item’s policy.</p>}
    <CipherBlock text={item.ciphertext} caption="Encrypted in the owner’s browser before upload. Heirloom’s server cannot read it." />
    <div className="actions">
      <button className={primaryOpen ? undefined : "button-secondary"} disabled={busy} onClick={handleOpen}><Icon name={operator ? "key" : "unlock"} size={18} />{busy ? "Opening…" : operator ? "Try to open" : "Open"}</button>
      {plaintext !== null && <><button className="button-quiet" onClick={() => { setPlaintext(null); setCompare(false); }}>Hide plaintext</button>{access === "heir" && <button className="button-quiet" aria-pressed={compare} onClick={() => setCompare(!compare)}>{compare ? "Close comparison" : "Compare with stored ciphertext"}</button>}</>}
    </div>
    {busy && <div className="item-checking" role="status"><NodeGrid state="checking" compact /></div>}
    {plaintext !== null && <>
      <div className={compare ? "split-screen" : undefined}>
        <PlainPanel>{plaintext}</PlainPanel>
        {compare && <CipherBlock full heading="What Heirloom stores" text={item.ciphertext} caption="The same item, exactly as the server holds it." />}
      </div>
      {/* A successful decrypt reports no node count: say only what success implies (at least the threshold agreed). */}
      <TideProof tone="released" lines={proofLines}><NodeGrid state="released" compact headline={`Threshold met: at least ${TIDE_NETWORK.required} of ${TIDE_NETWORK.total} independent nodes agreed`} /></TideProof>
    </>}
    {error !== undefined && <><RefusalPanel error={error} />{access === "heir" && !operator && !otherRecipient && <div className="signin-hint"><Callout tone="info" title="Waiting for a release?"><p>Roles arrive on your next sign-in. If a release was just approved, sign out and back in.</p></Callout></div>}</>}
  </article>;
}
