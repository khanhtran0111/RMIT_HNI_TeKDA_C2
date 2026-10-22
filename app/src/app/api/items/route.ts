import { withAuth, withRole } from "@/lib/auth/middleware";
import { apiError, apiRoute } from "@/lib/api";
import { appendItem, readItems, validateItemInput, type ItemInput } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = apiRoute(withAuth(async () => Response.json({ items: readItems() })));
export const POST = apiRoute(withRole("vault-owner-mai", async (request, jwt) => {
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError("VALIDATION", "Expected a JSON item.", 422); }
  const error = validateItemInput(body);
  if (error) return apiError("VALIDATION", error, 422);
  if (typeof jwt.preferred_username !== "string" || !jwt.preferred_username) return apiError("FORBIDDEN", "A username is required to seal an item.", 403);
  const item = appendItem({ ...(body as ItemInput), ownerUsername: jwt.preferred_username });
  return Response.json({ item }, { status: 201 });
}));
