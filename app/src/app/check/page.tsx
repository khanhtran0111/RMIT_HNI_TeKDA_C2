"use client";

// Dev A diagnostic page (SPEC Part 2, Task A5): proves the record policies work end to end before
// Dev B's /vault and /heir exist. Not part of the demo. Sign in as mai, then as long.

import { useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import { encryptForRecord, decryptForRecord } from "@/lib/tide/relationship";
import { classifyTideError } from "@/lib/tide/refusal";

const KEY = "heirloom-check-ciphertext";
const abs = (path: string) => new URL(path, window.location.origin).toString();

function describe(err: unknown) {
  const c = classifyTideError(err);
  const e = err as { message?: unknown; cause?: unknown };
  return JSON.stringify({ ...c, rawMessage: String(e?.message ?? err), rawCause: e?.cause === undefined ? null : String((e.cause as { message?: unknown })?.message ?? e.cause) }, null, 2);
}

export default function CheckPage() {
  const { isInitializing, authenticated, login, logout, secureFetch, getValueFromIdToken } = useTideCloak();
  const [log, setLog] = useState<string[]>([]);
  const add = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${s}`, ...l]);

  const policies = async (record: string) => {
    const res = await secureFetch(abs(`/api/policies?record=${record}`));
    if (!res.ok) throw new Error(`/api/policies ${res.status}`);
    return (await res.json()) as { owner: string | null; heir: string | null };
  };

  const run = (label: string, fn: () => Promise<string>) => async () => {
    add(`${label}: running...`);
    try {
      add(`${label}: OK ${await fn()}`);
    } catch (err) {
      add(`${label}: REFUSED/ERROR\n${describe(err)}`);
    }
  };

  if (isInitializing) return <main style={{ padding: 24 }}>Loading...</main>;
  if (!authenticated) return <main style={{ padding: 24 }}><button onClick={login}>Sign in</button></main>;

  const me = String(getValueFromIdToken("preferred_username") ?? "");
  return (
    <main style={{ padding: 24, fontFamily: "var(--font-body)", color: "var(--text)", maxWidth: 900 }}>
      <h1>Policy check (Dev A, not part of the demo)</h1>
      <p>Signed in as <b>{me}</b> <button onClick={logout}>Sign out</button></p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button onClick={run("encrypt mai-bank (owner policy)", async () => {
          const p = await policies("mai-bank");
          const ct = await encryptForRecord("SYNTHETIC check " + new Date().toISOString(), "mai-bank", p.owner!);
          localStorage.setItem(KEY, ct);
          return `ciphertext ${ct.slice(0, 40)}... (saved in this browser)`;
        })}>1. Encrypt (owner)</button>
        <button onClick={run("decrypt mai-bank (owner policy)", async () => {
          const p = await policies("mai-bank");
          return await decryptForRecord(localStorage.getItem(KEY) ?? "", "mai-bank", p.owner!);
        })}>2. Decrypt (owner)</button>
        <button onClick={run("decrypt mai-bank (heir policy)", async () => {
          const p = await policies("mai-bank");
          return await decryptForRecord(localStorage.getItem(KEY) ?? "", "mai-bank", p.heir!);
        })}>3. Decrypt (heir)</button>
        <button onClick={run("decrypt mai-bank with the mai-care heir policy (wrong record)", async () => {
          const p = await policies("mai-care");
          return await decryptForRecord(localStorage.getItem(KEY) ?? "", "mai-bank", p.heir!);
        })}>4. Wrong-record policy</button>
        <button onClick={() => { const v = prompt("ciphertext"); if (v) localStorage.setItem(KEY, v); }}>Paste ciphertext</button>
        <button onClick={() => { navigator.clipboard?.writeText(localStorage.getItem(KEY) ?? ""); add("ciphertext copied"); }}>Copy ciphertext</button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", background: "var(--surface-sunk)", padding: 12, marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 13 }}>{log.join("\n\n")}</pre>
    </main>
  );
}
