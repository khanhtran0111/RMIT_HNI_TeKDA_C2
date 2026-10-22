// Signed relationship policies, keyed by policy id ("owner:mai-care", "heir:mai-bank", ...).
// Server only (uses fs). The page imports the PolicyEntry type only.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export interface PolicyEntry {
  recordId: string;
  subject: { type: "Role"; id: string };
  access: "read" | "write" | "read-write";
  policy: string; // signed policy, base64
}

const storePath = () => join(process.cwd(), "data", "heirloom", "policies.json");

export function readPolicies(): Record<string, PolicyEntry> {
  const path = storePath();
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, PolicyEntry>;
}

export function writePolicy(id: string, entry: PolicyEntry): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  const all = readPolicies();
  all[id] = entry;
  writeFileSync(path, JSON.stringify(all, null, 2) + "\n", "utf-8");
}
