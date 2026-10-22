import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RefusalPanel } from "../src/components/RefusalPanel";
import { StatusChip } from "../src/components/StatusChip";

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
