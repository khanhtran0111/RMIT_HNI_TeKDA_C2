import { NextRequest } from "next/server";
import { withClientRole } from "@/lib/auth/middleware";
import { loadTideConfig } from "@/lib/auth/tidecloakConfig";

const fail = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

// GET /api/admin-policy (tide-realm-admin) -> { adminPolicy: "<b64>" }
// Forwards the caller's own token. The caller's DPoP proof is bound to THIS url (htu), so TideCloak
// may reject it; then /setup fetches the admin policy from the browser instead (501).
export const GET = withClientRole("realm-management", "tide-realm-admin", async (req: NextRequest) => {
  const config = loadTideConfig();
  const base = config["auth-server-url"].replace(/\/+$/, "");
  const url = `${base}/admin/realms/${encodeURIComponent(config.realm)}/iga/role-policies/name/tide-realm-admin`;

  const headers: Record<string, string> = { Accept: "application/json" };
  const auth = req.headers.get("authorization");
  const dpop = req.headers.get("dpop");
  if (auth) headers.Authorization = auth;
  if (dpop) headers.DPoP = dpop;

  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store" });
  } catch (err) {
    return fail(502, "UPSTREAM", `TideCloak unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return fail(501, "UPSTREAM", "fetch the admin policy from the browser");
  }
  if (!res.ok) return fail(502, "UPSTREAM", `TideCloak answered ${res.status}`);

  const body = (await res.json().catch(() => null)) as { policy?: unknown } | null;
  if (!body || typeof body.policy !== "string" || !body.policy) {
    return fail(502, "UPSTREAM", "TideCloak response has no policy field");
  }
  return Response.json({ adminPolicy: body.policy });
});
