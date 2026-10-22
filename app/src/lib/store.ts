import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type RecordId = "mai-care" | "mai-bank";
export type Recipient = "linh" | "long";
export interface ItemInput { recordId: RecordId; title: string; recipientUsername: Recipient; ciphertext: string }
export interface Item extends ItemInput { id: string; ownerUsername: string; createdAt: string }
export interface PolicyEntry {
  recordId: string;
  subject: { type: string; id: string };
  access: string;
  policy: string;
}
export interface OperatorStore {
  files: { "items.json": Item[]; "policies.json": Record<string, PolicyEntry> };
  demoIds: { long?: string; "heir-bank-mai"?: string };
}
const storeDirectory = () => join(process.cwd(), "data", "heirloom");

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(file, "utf8")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error; // Corrupt data must never be silently replaced with an empty vault.
  }
}

export function readItems(directory = storeDirectory()): Item[] {
  return readJson<Item[]>(join(directory, "items.json"), []);
}

export function validateItemInput(input: unknown): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "Expected an item object.";
  const body = input as Record<string, unknown>;
  if (typeof body.recordId !== "string" || !["mai-care", "mai-bank"].includes(body.recordId)) return "recordId must be mai-care or mai-bank.";
  if (typeof body.recipientUsername !== "string" || !["linh", "long"].includes(body.recipientUsername)) return "recipientUsername must be linh or long.";
  if ((body.recordId === "mai-care" && body.recipientUsername !== "linh") || (body.recordId === "mai-bank" && body.recipientUsername !== "long")) return "The recipient must match the signed record policy: care wishes for Linh, bank logins for Long.";
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 120) return "Title must contain 1–120 characters.";
  if (typeof body.ciphertext !== "string" || !body.ciphertext.trim()) return "A non-empty ciphertext is required.";
  if (Object.keys(body).some(key => !["recordId", "title", "recipientUsername", "ciphertext"].includes(key))) return "Only item metadata and ciphertext are accepted; never submit plaintext.";
  return null;
}

export function appendItem(input: ItemInput & { ownerUsername: string }, directory = storeDirectory()): Item {
  // Explicit projection keeps content, tokens and client-supplied IDs out of storage.
  const item: Item = {
    id: randomUUID(), recordId: input.recordId, title: input.title.trim(),
    recipientUsername: input.recipientUsername, ownerUsername: input.ownerUsername,
    ciphertext: input.ciphertext, createdAt: new Date().toISOString(),
  };
  mkdirSync(directory, { recursive: true });
  const items = readItems(directory);
  const temporary = join(directory, `items.${randomUUID()}.tmp`);
  writeFileSync(temporary, JSON.stringify([...items, item], null, 2), "utf8");
  renameSync(temporary, join(directory, "items.json"));
  return item;
}

export function readOperatorStore(directory = storeDirectory()): OperatorStore {
  const ids = readJson<OperatorStore["demoIds"]>(join(directory, "demo-ids.json"), {});
  return {
    files: {
      "items.json": readItems(directory),
      "policies.json": readJson<Record<string, PolicyEntry>>(join(directory, "policies.json"), {}),
    },
    demoIds: {
      ...(typeof ids.long === "string" ? { long: ids.long } : {}),
      ...(typeof ids["heir-bank-mai"] === "string" ? { "heir-bank-mai": ids["heir-bank-mai"] } : {}),
    },
  };
}
