import assert from "node:assert/strict";
import { test } from "node:test";
import { tryReleaseToLong } from "../src/lib/operator";

test("operator release probe targets TideCloak directly and displays the actual 403", async () => {
  const result = await tryReleaseToLong(async (url, init) => {
    assert.equal(url, "http://localhost:8080/admin/realms/heirloom/users/long-id/role-mappings/realm");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), [{ id: "role-id", name: "heir-bank-mai" }]);
    return new Response("Forbidden", { status: 403 });
  }, { "auth-server-url": "http://localhost:8080/", realm: "heirloom" }, { long: "long-id", "heir-bank-mai": "role-id" });
  assert.deepEqual(result, { status: 403, unexpectedSuccess: false, message: "403 from TideCloak: not a seat" });
});
test("an unexpected successful role grant is surfaced as a bug, never a refusal", async () => {
  const result = await tryReleaseToLong(async () => new Response(null, { status: 202 }), { "auth-server-url": "http://localhost:8080", realm: "heirloom" }, { long: "long-id", "heir-bank-mai": "role-id" });
  assert.equal(result.unexpectedSuccess, true);
  assert.match(result.message, /BUG.*202/);
  assert.doesNotMatch(result.message, /not a seat/);
});
test("missing bootstrap ids prevents the probe instead of guessing identities", async () => {
  await assert.rejects(tryReleaseToLong(async () => { throw new Error("must not call"); }, { "auth-server-url": "http://localhost:8080", realm: "heirloom" }, {}), /demo-ids.json/);
});
