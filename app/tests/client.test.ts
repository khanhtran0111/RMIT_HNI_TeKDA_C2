import assert from "node:assert/strict";
import { test } from "node:test";
import { createVaultClient } from "../src/lib/tide/client";

const fixture = { recordId: "mai-bank" as const, title: "Bank", recipientUsername: "long" as const, content: "SECRET IN BROWSER" };
test("seal passes exactly one record id to crypto and posts ciphertext without plaintext", async () => {
  const posted: unknown[] = [];
  const api = async (url: string, init?: RequestInit) => {
    if (url === "/api/policies?record=mai-bank") return Response.json({ owner: "OWNER-POLICY", heir: "HEIR-POLICY" });
    assert.equal(url, "/api/items");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body)); posted.push(body);
    return Response.json({ item: { ...body, id: "item-1", ownerUsername: "mai", createdAt: "2026-10-22T00:00:00Z" } }, { status: 201 });
  };
  const client = createVaultClient(api, {
    async encryptForRecord(...args: [string, string, string]) { assert.deepEqual(args, ["SECRET IN BROWSER", "mai-bank", "OWNER-POLICY"]); return "REAL-CIPHERTEXT"; },
    async decryptForRecord() { throw new Error("unexpected decrypt"); },
  });
  const item = await client.sealItem(fixture);
  assert.equal(item.id, "item-1");
  assert.deepEqual(posted, [{ recordId: "mai-bank", title: "Bank", recipientUsername: "long", ciphertext: "REAL-CIPHERTEXT" }]);
});
test("open uses the requested policy and preserves the original network refusal without retry", async () => {
  const refusal = new Error("TIDE-TIDEJS-NET-THRESHOLD_FAILURE", { cause: "heir-bank-mai role not found in doken" });
  let attempts = 0;
  const client = createVaultClient(async () => Response.json({ owner: "OWNER", heir: "HEIR" }), {
    async encryptForRecord() { throw new Error("unexpected encrypt"); },
    async decryptForRecord(...args: [string, string, string]) { attempts++; assert.deepEqual(args, ["CIPHER", "mai-bank", "HEIR"]); throw refusal; },
  });
  await assert.rejects(client.openItem({ recordId: "mai-bank", ciphertext: "CIPHER" }, "heir"), error => error === refusal);
  assert.equal(attempts, 1);
});
test("missing signed policy or failed encryption never writes an item", async () => {
  let writes = 0;
  const api = async (_url: string, init?: RequestInit) => { if (init?.method === "POST") writes++; return Response.json({ owner: "", heir: "" }); };
  const client = createVaultClient(api, { async encryptForRecord() { throw new Error("must not encrypt"); }, async decryptForRecord() { throw new Error("must not decrypt"); } });
  await assert.rejects(client.sealItem(fixture), /signed.*policy/i);
  assert.equal(writes, 0);
});
test("API authorization errors remain app errors, separate from Tide refusals", async () => {
  const client = createVaultClient(async () => Response.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, { status: 403 }));
  await assert.rejects(client.getItems(), /403.*Forbidden/);
});
