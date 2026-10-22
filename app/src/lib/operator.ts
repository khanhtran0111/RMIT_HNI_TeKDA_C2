import type { ApiFetch } from "./tide/client";
import type { OperatorStore } from "./store";

export async function tryReleaseToLong(apiFetch: ApiFetch, config: { "auth-server-url": string; realm: string }, ids: OperatorStore["demoIds"]) {
  if (!ids.long || !ids["heir-bank-mai"]) throw new Error("This server is not configured with Long’s user ID and the heir-bank-mai role ID (data/heirloom/demo-ids.json). Run npm run demo-ids.");
  const base = config["auth-server-url"].replace(/\/+$/, "");
  const response = await apiFetch(`${base}/admin/realms/${encodeURIComponent(config.realm)}/users/${encodeURIComponent(ids.long)}/role-mappings/realm`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ id: ids["heir-bank-mai"], name: "heir-bank-mai" }]),
  });
  return {
    status: response.status,
    unexpectedSuccess: response.ok,
    message: response.status === 403 ? "403 from TideCloak: not a seat"
      : response.ok ? `BUG: TideCloak returned ${response.status} for the operator’s role grant. This account should not be able to grant roles: stop the demo and check its realm roles.`
      : `${response.status} from TideCloak: ${response.statusText || "request failed"}. The expected not-a-seat refusal has not been demonstrated.`,
  };
}
