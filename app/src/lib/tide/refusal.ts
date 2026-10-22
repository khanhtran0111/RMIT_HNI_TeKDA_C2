// Classifies an error thrown by the Tide SDK (encryptForRecord / decryptForRecord / signing).
// A TIDE-TIDEJS-NET-THRESHOLD_FAILURE is the network REFUSING, not an outage, unless the SDK says the
// nodes timed out or are down. Pure: no React, no Node APIs; safe on client and server.
//
// Shape on the live browser path (heimdall-tide 0.14.41 RequestEnclave.decrypt): the enclave's error
// crosses postMessage and is rethrown as `Error(string)`, so there is no `cause`. The code, the node
// count and the contract's reason can only be read from the message text. Two text shapes exist:
//   "TIDE-TIDEJS-NET-THRESHOLD_FAILURE: Could not reach enough VVK ORKs (got 0 of 14 required, ...)"
//   TideError.toString(): "TideError[TIDE-TIDEJS-NET-THRESHOLD_FAILURE]: <displayMessage>\n  details: ...\n    - <url> [CODE] <reason>\n  cause: ..."
// The exact string is not captured yet (SPEC Task A5): fill the markers below from /setup "Test refusal".

// Filled later by a human from the "Test refusal" box on /setup. Empty = not used.
export const REFUSAL_MARKER = "";
export const OUTAGE_MARKER = "";

export interface TideErrorClass {
  kind: "refused" | "outage" | "unknown";
  message: string;
  cause: string;
  /** The policy check's reason: `cause` when present, else the reason line found in the message. */
  reason: string;
  nodes?: { got: number; required: number };
}

// Reasons only the policy check gives. "does not match" is generic, so in a message it counts only
// when the message is clearly Tide's (TIDE_TEXT); in `cause` it counts as before.
const STRONG_REASON = /not found in doken|not found in list of roles|Tags do not contain|not found for this decryption request/;
const CONTRACT_REASON = new RegExp(`${STRONG_REASON.source}|does not match`);
const TIDE_TEXT = /TIDE-|TideError|\bORKs?\b/;
const REASON_LINE = /'[^'\n]+' role not found in doken\.|[^\n[\]]*(?:not found in doken|does not match|not found in list of roles|Tags do not contain|not found for this decryption request)[^\n[\]]*/;
// The SDK's own NET_THRESHOLD_FAILURE variants for "not enough nodes answered" (@tideorg/js PromiseRace).
const NODES_UNAVAILABLE = /thresholdTimeoutFailure|before timeout|for this account are down|enclave\.timeout/;
const NOT_ENOUGH_NODES = /Could not reach enough \S+ ORKs/;

export function classifyTideError(err: unknown): TideErrorClass {
  const e = (typeof err === "object" && err !== null ? err : {}) as { message?: unknown; cause?: unknown; code?: unknown };
  const message = typeof e.message === "string" && e.message ? e.message : String(err);
  const code = typeof e.code === "string" ? e.code : "";

  let cause = "";
  if (typeof e.cause === "string") {
    cause = e.cause;
  } else if (typeof e.cause === "object" && e.cause !== null) {
    const m = (e.cause as { message?: unknown }).message;
    if (typeof m === "string") cause = m;
  }
  const tideMessage = TIDE_TEXT.test(message) || STRONG_REASON.test(message);
  const reason = cause || (tideMessage ? REASON_LINE.exec(message)?.[0].trim() ?? "" : "");

  const out: TideErrorClass = { kind: "unknown", message, cause, reason };
  const n = /got (\d+) of (\d+)/.exec(message);
  if (n) out.nodes = { got: Number(n[1]), required: Number(n[2]) };

  if (OUTAGE_MARKER && (message.includes(OUTAGE_MARKER) || cause.includes(OUTAGE_MARKER))) {
    out.kind = "outage";
  } else if (NODES_UNAVAILABLE.test(message)) {
    out.kind = "outage";
  } else if (
    code.includes("THRESHOLD_FAILURE") ||
    message.includes("THRESHOLD_FAILURE") ||
    NOT_ENOUGH_NODES.test(message) ||
    (REFUSAL_MARKER && (message.includes(REFUSAL_MARKER) || cause.includes(REFUSAL_MARKER))) ||
    CONTRACT_REASON.test(cause) ||
    (tideMessage && CONTRACT_REASON.test(message))
  ) {
    out.kind = "refused";
  }
  return out;
}
