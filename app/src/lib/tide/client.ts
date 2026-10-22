import type { Item, RecordId } from "../store";
import type { Fixture } from "../fixtures";

export type ApiFetch = (url: string, init?: RequestInit) => Promise<Response>;
export interface RecordCrypto {
  encryptForRecord(data: string, recordId: string, policy: string): Promise<string>;
  decryptForRecord(ciphertext: string, recordId: string, policy: string): Promise<string>;
}
const defaultCrypto: RecordCrypto = {
  async encryptForRecord(...args) { return (await import("@/tide-integration/relationship")).encryptForRecord(...args); },
  async decryptForRecord(...args) { return (await import("@/tide-integration/relationship")).decryptForRecord(...args); },
};

export async function apiJson<T>(response: Response): Promise<T> {
  let body;
  try { body = await response.json(); }
  catch { throw new Error(`${response.status}: The app returned an unreadable response. Check that Dev A’s API routes are connected.`); }
  if (!response.ok) throw new Error(`${response.status}: ${body.error?.message ?? body.error ?? response.statusText}`);
  return body as T;
}

export function createVaultClient(apiFetch: ApiFetch, crypto: RecordCrypto = defaultCrypto) {
  async function getPolicies(record: RecordId) {
    const policies = await apiJson<{ owner: string; heir: string }>(await apiFetch(`/api/policies?record=${encodeURIComponent(record)}`));
    return policies;
  }
  async function getPolicy(record: RecordId, access: "owner" | "heir") {
    const policies = await getPolicies(record);
    if (typeof policies[access] !== "string" || !policies[access].trim()) throw new Error(`A signed ${access} policy for ${record} is missing. Ask a seat to complete /setup.`);
    return policies[access];
  }
  return {
    getPolicies,
    async getItems(): Promise<Item[]> { return (await apiJson<{ items: Item[] }>(await apiFetch("/api/items"))).items; },
    async sealItem(input: Fixture): Promise<Item> {
      const policy = await getPolicy(input.recordId, "owner");
      const ciphertext = await crypto.encryptForRecord(input.content, input.recordId, policy);
      const body = { recordId: input.recordId, title: input.title.trim(), recipientUsername: input.recipientUsername, ciphertext };
      return (await apiJson<{ item: Item }>(await apiFetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))).item;
    },
    async openItem(item: Pick<Item, "recordId" | "ciphertext">, access: "owner" | "heir"): Promise<string> {
      const policy = await getPolicy(item.recordId, access);
      return crypto.decryptForRecord(item.ciphertext, item.recordId, policy);
    },
  };
}
