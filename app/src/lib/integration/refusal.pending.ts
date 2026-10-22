// Temporary A3-compatible classifier. No outage is claimed before Dev A measures its marker.
export const REFUSAL_MARKER = "";
export const OUTAGE_MARKER = "";
export interface TideErrorClassification {
  kind: "refused" | "outage" | "unknown";
  message: string;
  cause: string;
  nodes?: { got: number; required: number };
}
export function classifyTideError(error: unknown): TideErrorClassification {
  const value = error && typeof error === "object" ? error as { message?: unknown; cause?: unknown } : {};
  const message = typeof value.message === "string" ? value.message : String(error ?? "Unknown error");
  const cause = typeof value.cause === "string" ? value.cause
    : value.cause && typeof value.cause === "object" && "message" in value.cause ? String(value.cause.message) : "";
  const match = message.match(/got\s+(\d+)\s+of\s+(\d+)/i);
  return {
    kind: message.includes("TIDE-TIDEJS-NET-THRESHOLD_FAILURE") ? "refused" : "unknown",
    message, cause,
    ...(match ? { nodes: { got: Number(match[1]), required: Number(match[2]) } } : {}),
  };
}
