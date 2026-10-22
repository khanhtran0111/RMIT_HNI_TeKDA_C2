import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { appendItem, readItems, readOperatorStore, validateItemInput } from "../src/lib/store";

const directory = mkdtempSync(join(tmpdir(), "heirloom-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const input = { recordId: "mai-bank", title: "Bank and pension logins", recipientUsername: "long", ciphertext: "ZW5jcnlwdGVk" } as const;

test("a new store is empty and persists only the ciphertext item fields", () => {
  assert.deepEqual(readItems(directory), []);
  const untrustedInput = { ...input, ownerUsername: "mai", content: "NEVER STORE THIS" };
  const item = appendItem(untrustedInput, directory);
  assert.equal(item.recordId, "mai-bank");
  assert.match(item.id, /^[0-9a-f-]{36}$/);
  assert.ok(Number.isFinite(Date.parse(item.createdAt)));
  assert.deepEqual(readItems(directory), [item]);
  assert.ok(!readFileSync(join(directory, "items.json"), "utf8").includes("NEVER STORE THIS"));
  appendItem({ ...input, ownerUsername: "mai" }, directory);
  assert.equal(readItems(directory).length, 2);
});

test("invalid records, recipients, ciphertext and titles are rejected before a write", () => {
  assert.equal(validateItemInput(input), null);
  for (const bad of [null, [], {}, { ...input, recordId: "../secret" }, { ...input, recipientUsername: "ops" }, { ...input, ciphertext: " " }, { ...input, ciphertext: 10 }, { ...input, title: "x".repeat(121) }, { ...input, title: " " }, { ...input, content: "plaintext" }]) {
    assert.equal(typeof validateItemInput(bad), "string", JSON.stringify(bad));
  }
  assert.equal(validateItemInput({ ...input, title: "x".repeat(120) }), null);
});

test("operator snapshot returns the raw ciphertext files and no bootstrap credentials", () => {
  const snapshot = readOperatorStore(directory);
  assert.deepEqual(snapshot.files["items.json"], readItems(directory));
  assert.deepEqual(snapshot.files["policies.json"], {});
  assert.deepEqual(snapshot.demoIds, {});
  assert.equal("tidecloak.json" in snapshot.files, false);
});
test("array-shaped identifiers cannot bypass the string record and recipient allowlists", () => {
  assert.equal(typeof validateItemInput({ ...input, recordId: ["mai-bank"] }), "string");
  assert.equal(typeof validateItemInput({ ...input, recipientUsername: ["long"] }), "string");
});
