import { loadTideConfig } from "@/lib/auth/tidecloakConfig";
import { withAuth } from "@/lib/auth/middleware";
import { apiError, apiRoute } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Template leftover: the app does not call it (pages get the public adapter through TideCloakProvider's
// config prop). Kept behind the same token + DPoP check as every other /api route, and its error
// does not echo server paths.
export const GET = apiRoute(withAuth(async () => {
  try {
    return Response.json(loadTideConfig());
  } catch {
    return apiError("CONFIG", "The Tide adapter configuration is not available.", 500);
  }
}));
