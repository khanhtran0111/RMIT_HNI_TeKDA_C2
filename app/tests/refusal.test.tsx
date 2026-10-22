import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RefusalPanel } from "../src/components/RefusalPanel";
import { StatusChip } from "../src/components/StatusChip";
import { classifyTideError } from "../src/lib/tide/refusal";

const message = "TIDE-TIDEJS-NET-THRESHOLD_FAILURE: Could not reach enough VVK ORKs (got 0 of 14 required)";
test("network refusal shows node count and the contract cause", () => {
  const html = renderToStaticMarkup(<RefusalPanel error={{ message, cause: "'heir-bank-mai' role not found in doken." }} />);
  assert.match(html, /Refused by the Tide network/);
  assert.match(html, /0 of 14 nodes would release this key/);
  assert.match(html, /heir-bank-mai/);
  assert.match(html, /Show raw error/);
  assert.doesNotMatch(html, /try again|service unavailable/i);
});
test("missing, nested and non-string causes retain raw message without crashing", () => {
  for (const cause of [undefined, null, 7, { message: "Nested refusal" }, { detail: "unknown" }]) {
    const html = renderToStaticMarkup(<RefusalPanel error={{ message, cause }} />);
    assert.match(html, /TIDE-TIDEJS-NET-THRESHOLD_FAILURE/);
  }
});
test("unmeasured transport errors stay unknown rather than claiming a Tide refusal or outage", () => {
  const html = renderToStaticMarkup(<RefusalPanel error={new Error("Failed to fetch")} />);
  assert.match(html, /Failed to fetch/);
  assert.doesNotMatch(html, /Refused by the Tide network|Cannot reach the Tide network/);
});
test("status chips expose both icon and word", () => {
  for (const state of ["sealed", "pending", "released", "refused"] as const) {
    assert.match(renderToStaticMarkup(<StatusChip state={state} />), new RegExp(state.toUpperCase()));
  }
});

// The shapes below are derived from the installed SDK source, NOT captured from the live network:
// heimdall-tide RequestEnclave.decrypt rethrows the enclave's error as Error(string) (no cause), and
// @tideorg/js PromiseRace / TideError.toString() build the text. Replace with the /setup capture (Task A5).
const liveRefusal = [
  "TideError[TIDE-TIDEJS-NET-THRESHOLD_FAILURE]: Could not reach enough VVK ORKs (got 0 of 14 required, 20 of 20 failed)",
  "  source:   Tools/Utils.ts:PromiseRace",
  "  details:  20 underlying failure(s):",
  "    - https://ork-1.example/decrypt [TIDE-ORK-POLICY] 'heir-bank-mai' role not found in doken.",
  "  cause:    Error: 'heir-bank-mai' role not found in doken.",
].join("\n");
test("live-path refusal arrives as Error(string) with no cause and still shows the policy's reason", () => {
  const result = classifyTideError(new Error(liveRefusal));
  assert.equal(result.kind, "refused");
  assert.equal(result.cause, "");
  assert.equal(result.reason, "'heir-bank-mai' role not found in doken.");
  assert.deepEqual(result.nodes, { got: 0, required: 14 });
  const html = renderToStaticMarkup(<RefusalPanel error={new Error(liveRefusal)} />);
  assert.match(html, /Refused by the Tide network/);
  assert.match(html, /Reason given by the policy check/);
});
test("refusals without the code prefix, with the code on the object, or as a bare per-node reason are refused", () => {
  assert.equal(classifyTideError(new Error("Could not reach enough VVK ORKs (got 0 of 14 required, 20 of 20 failed)")).kind, "refused");
  assert.equal(classifyTideError({ message: "Could not complete", code: "TIDE-TIDEJS-NET-THRESHOLD_FAILURE" }).kind, "refused");
  const bare = classifyTideError(new Error("'heir-care-mai' role not found in doken."));
  assert.equal(bare.kind, "refused");
  assert.equal(bare.reason, "'heir-care-mai' role not found in doken.");
  assert.equal(classifyTideError(new Error("Policy not found for this decryption request")).kind, "refused");
});
test("timeouts and down nodes are outages, never a policy refusal", () => {
  for (const message of [
    "TIDE-TIDEJS-NET-THRESHOLD_FAILURE: enclave.thresholdTimeoutFailure (got 3 of 14 required VVK ORKs before timeout)",
    "TIDE-TIDEJS-NET-THRESHOLD_FAILURE: VVK ORKs for this account are down (got 0 of 14 required)",
  ]) {
    assert.equal(classifyTideError(new Error(message)).kind, "outage");
    const html = renderToStaticMarkup(<RefusalPanel error={new Error(message)} />);
    assert.doesNotMatch(html, /Refused by the Tide network|checked this item/);
  }
});
test("app errors that merely say 'does not match' are not read as Tide refusals", () => {
  const result = classifyTideError(new Error("signed policy does not match owner:mai-bank"));
  assert.equal(result.kind, "unknown");
  assert.equal(result.reason, "");
});
test("a refused seal is described as a seal, not as an item no one can open", () => {
  const html = renderToStaticMarkup(<RefusalPanel action="seal" error={new Error(liveRefusal)} />);
  assert.match(html, /aria-label="Seal result"/);
  assert.match(html, /was not sealed or sent/);
  assert.doesNotMatch(html, /cannot be decrypted by anyone/);
});
