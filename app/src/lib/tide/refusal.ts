// Classifies an error thrown by the Tide SDK (encryptForRecord / decryptForRecord / signing).
// A TIDE-TIDEJS-NET-THRESHOLD_FAILURE is the network REFUSING (the contract's reason is in `cause`),
// not an outage. "outage" is returned only when the error matches OUTAGE_MARKER, captured by hand
// at setup (SPEC Task A5). Pure: no React, no Node APIs; safe on client and server.

// Filled later by a human from the "Test refusal" box on /setup. Empty = not used.
export const REFUSAL_MARKER = "";
export const OUTAGE_MARKER = "";

export interface TideErrorClass {
  kind: "refused" | "outage" | "unknown";
  message: string;
  cause: string;
  nodes?: { got: number; required: number };
}

const CONTRACT_REASON = /not found in doken|does not match|not found in list of roles|Tags do not contain/;

export function classifyTideError(err: unknown): TideErrorClass {
  const e = (typeof err === "object" && err !== null ? err : {}) as { message?: unknown; cause?: unknown };
  const message = typeof e.message === "string" && e.message ? e.message : String(err);

  let cause = "";
  if (typeof e.cause === "string") {
    cause = e.cause;
  } else if (typeof e.cause === "object" && e.cause !== null) {
    const m = (e.cause as { message?: unknown }).message;
    if (typeof m === "string") cause = m;
  }

  const out: TideErrorClass = { kind: "unknown", message, cause };
  const n = /got (\d+) of (\d+)/.exec(message);
  if (n) out.nodes = { got: Number(n[1]), required: Number(n[2]) };

  if (OUTAGE_MARKER && (message.includes(OUTAGE_MARKER) || cause.includes(OUTAGE_MARKER))) {
    out.kind = "outage";
  } else if (
    message.includes("THRESHOLD_FAILURE") ||
    (REFUSAL_MARKER && (message.includes(REFUSAL_MARKER) || cause.includes(REFUSAL_MARKER))) ||
    CONTRACT_REASON.test(cause)
  ) {
    out.kind = "refused";
  }
  return out;
}
