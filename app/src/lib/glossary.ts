// Plain-language definitions for <Term id="...">. One source of truth for every page.
// Rules: at most 30 words each, plain English, and stay inside the verified facts
// (one seat in this prototype, 2 of 3 in production; 14 of 20 Tide nodes; Heirloom is never a seat).

export type GlossaryEntry = { term: string; short: string };

const ENTRIES = {
  seat: {
    term: "Seat",
    short: "An independent person the owner chose, such as a notary. A seat approves releases but cannot read items. Heirloom is never one. In production, 2 of 3 must approve.",
  },
  "tide-network": {
    term: "Tide network",
    short: "Independent servers (nodes), each holding only a piece of every key. Here 14 of 20 must agree, after checking the item's policy, before an item can be opened.",
  },
  enclave: {
    term: "Tide enclave",
    short: "A secure signing window from Tide (on tideprotocol.com), outside Heirloom. A seat approves a release there, so Heirloom cannot approve on the seat's behalf.",
  },
  ciphertext: {
    term: "Ciphertext",
    short: "Scrambled text. Each item is encrypted in the owner's browser before upload, so Heirloom's server holds the content only in this unreadable form.",
  },
  policy: {
    term: "Policy",
    short: "A signed rule the Tide network checks before releasing a key, such as: only someone holding the heir role for this record may open it. A seat signs it once.",
  },
  release: {
    term: "Release",
    short: "Giving one item's recipient the right to open it. TideCloak only files the request; a seat must approve it in the Tide enclave. It applies at their next sign-in.",
  },
  threshold: {
    term: "Threshold",
    short: "How many independent parties must agree. Releasing an item: 1 seat in this prototype, 2 of 3 in production. Opening it: 14 of 20 Tide network nodes.",
  },
  recipient: {
    term: "Recipient",
    short: "The one person an item is for, chosen by the owner when sealing it. Apart from the owner, only they can open it, after a seat releases it.",
  },
  tidecloak: {
    term: "TideCloak",
    short: "Tide's sign-in and roles service. Asked to give a role, it does not grant it: it files a change request a seat must approve in the Tide enclave.",
  },
  "server-dump": {
    term: "Server dump",
    short: "What an insider with full server access would see: every byte Heirloom stores. Titles and recipients are readable; item contents are only ciphertext.",
  },
  // Extras used by existing pages (heir roles, the DPoP check on the server dump).
  "heir-role": {
    term: "Heir role",
    short: "The permission to open one named item. Only a seat can grant it, through an approved release. Heirloom cannot.",
  },
  dpop: {
    term: "DPoP",
    short: "Proof of possession: each request is signed by a key held in the signed-in browser, so a copied sign-in token alone is refused.",
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryId = keyof typeof ENTRIES;

export const GLOSSARY: Record<string, GlossaryEntry> = ENTRIES;

/** Typed lookup: getTerm("seat").short */
export function getTerm(id: GlossaryId): GlossaryEntry {
  return ENTRIES[id];
}
