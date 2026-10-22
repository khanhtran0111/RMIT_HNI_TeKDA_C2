import type { NextRequest } from "next/server";

export function apiError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

// Preserve the template's JWT + DPoP checks, normalize only its legacy error shape.
export function apiRoute(handler: (request: NextRequest) => Promise<Response>) {
  return async (request: NextRequest) => {
    try {
      const response = await handler(request);
      if (response.status === 401 || response.status === 403) {
        const body = await response.clone().json();
        const code = response.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN";
        return apiError(code, typeof body.error === "string" ? body.error : body.error?.message ?? code, response.status);
      }
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch {
      return apiError("INTERNAL", "The local vault store could not be read or written.", 500);
    }
  };
}
