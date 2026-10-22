"use client";

import { useState } from "react";
import { RefusalPanel } from "./RefusalPanel";
import { StatusChip } from "./StatusChip";
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
  return <article className="item">
    <div className="item-heading"><h3>{item.title}</h3><StatusChip state={state} label={busy ? "OPENING" : released && plaintext === null ? "RELEASED TO ME" : undefined} /></div>
    <div className="item-meta"><span>From <strong>{item.ownerUsername}</strong></span><span>For <strong>{item.recipientUsername}</strong></span><code>{item.recordId}</code><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(item.createdAt))}</time></div>
    {otherRecipient && <p className="help">Addressed to {item.recipientUsername}. Opening sends the same request to the Tide network so it can enforce the item’s policy.</p>}
    <div className="cipher-preview"><span className="help">Ciphertext stored by Heirloom</span><code>{item.ciphertext.slice(0, 100)}{item.ciphertext.length > 100 ? "…" : ""}</code></div>
    <div className="actions"><button className="button-secondary" disabled={busy} onClick={handleOpen}>{busy ? "Opening…" : operator ? "Try to open" : "Open"}</button>{plaintext !== null && <><button className="button-quiet" onClick={() => { setPlaintext(null); setCompare(false); }}>Hide plaintext</button>{access === "heir" && <button className="button-quiet" aria-pressed={compare} onClick={() => setCompare(!compare)}>{compare ? "Close comparison" : "Compare with stored ciphertext"}</button>}</>}</div>
    {plaintext !== null && <div className={compare ? "split-screen" : undefined}><div className="plaintext" role="status"><h3>✓ Opened in your browser</h3><pre>{plaintext}</pre></div>{compare && <div className="cipher-preview"><h3>What Heirloom stores</h3><pre>{item.ciphertext}</pre></div>}</div>}
    {error !== undefined && <><RefusalPanel error={error} />{access === "heir" && !operator && <p className="help" style={{ marginTop: 16 }}>Roles arrive on your next sign-in. If a release was just approved, sign out and back in.</p>}</>}
  </article>;
}
