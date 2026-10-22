import { withRole } from "@/lib/auth/middleware";
import { apiRoute } from "@/lib/api";
import { readOperatorStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = apiRoute(withRole("operator", async () => Response.json(readOperatorStore())));
