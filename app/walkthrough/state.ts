// Public walkthrough only (never imported by the Next.js app). Browser-side state for the simulated
// Heirloom backend: items, change requests and the chosen persona, kept in localStorage so a judge can
// switch persona (each switch is a page load) and the story carries on.
import type { Item } from "../src/lib/store";

export type ChangeRequest = {
  id: string; actionType: string; entityType: string; entityId: string; status: "PENDING" | "APPROVED" | "DENIED";
  authorizationCount: number; threshold: number; readyToCommit: boolean; rows: { USER_ID: string; ROLE_ID: string }[];
  createdAt: number; requestedBy: string; resolvedAt?: number; resolvedBy?: string; denyReason?: string;
  authorizers?: { username: string; timestamp: number }[]; comments: { body: string; by: string }[];
};
export type State = { items: Item[]; changeRequests: ChangeRequest[]; crCounter: number };

export const SEAT = "notary-duc";
export const USERS: Record<string, string> = { long: "user-long" };
export const ROLES: Record<string, string> = { "heir-bank-mai": "role-heir-bank-mai", "heir-care-mai": "role-heir-care-mai" };

const KEY = "heirloom-walkthrough-v1";
const PERSONA = "heirloom-walkthrough-as";

export function load(): State {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as State; } catch {}
  return { items: [], changeRequests: [], crCounter: 0 };
}
export function save(state: State) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
export function resetAll() { try { localStorage.removeItem(KEY); localStorage.removeItem(PERSONA); } catch {} }

export function persona(): string {
  const fromUrl = new URLSearchParams(window.location.search).get("as");
  if (fromUrl) { try { localStorage.setItem(PERSONA, fromUrl); } catch {} return fromUrl; }
  try { return localStorage.getItem(PERSONA) ?? "anonymous"; } catch { return "anonymous"; }
}
export function setPersona(name: string) { try { localStorage.setItem(PERSONA, name); } catch {} }

// A seat's approval commits the role grant; the heir holds the role from his next page load on.
export function heldRoles(state: State, username: string): string[] {
  const userId = USERS[username];
  if (!userId) return [];
  const granted = state.changeRequests.filter(c => c.status === "APPROVED" && c.entityId === userId).flatMap(c => c.rows.map(r => r.ROLE_ID));
  return Object.entries(ROLES).filter(([, id]) => granted.includes(id)).map(([name]) => name);
}
