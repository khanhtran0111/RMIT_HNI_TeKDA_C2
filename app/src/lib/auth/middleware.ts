import { NextRequest } from "next/server";
import { verifyTideJWT, hasRole, extractToken } from "./tideJWT";
import { verifyDpop, MemoryJtiStore, type JtiStore } from "./verifyDpop";

// A proof is accepted while |now - iat| <= IAT_SKEW, so a jti must be remembered until at least
// iat + IAT_SKEW. verifyDpop stores it until now + IAT_SKEW; keeping it one extra window covers a
// proof whose iat is up to IAT_SKEW in the future.
const IAT_SKEW = 300;
const inner = new MemoryJtiStore();
const jtiStore: JtiStore = {
  claim: (jti, expiresAtMs) => inner.claim(jti, expiresAtMs + IAT_SKEW * 1000),
};
import type { JWTPayload } from "jose";

type AuthHandler = (req: NextRequest, jwt: JWTPayload) => Promise<Response>;

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest) => {
    try {
      const token = extractToken(req.headers.get("authorization"));
      const jwt = await verifyTideJWT(token);
      // The signature alone is not enough. This realm issues sender-constrained tokens (cnf.jkt),
      // and without checking the DPoP proof a stolen token replays as a plain `Bearer` and passes
      // (AP-43). verifyDpop rejects an unbound token, a Bearer-scheme replay, a proof signed by a
      // different key, and a proof for another URL or method. It throws; the catch below answers 401.
      // No reverse proxy in front of this app, so x-forwarded-* headers are client-controlled:
      // never let them choose the htu the proof is checked against.
      await verifyDpop(req, token, jwt as { cnf?: { jkt?: string } }, {
        trustForwardedHeaders: false,
        iatSkewSeconds: IAT_SKEW,
        jtiStore,
      });
      return handler(req, jwt);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Unauthorized" },
        { status: 401 }
      );
    }
  };
}

export function withRole(role: string, handler: AuthHandler) {
  return withAuth(async (req, jwt) => {
    if (!hasRole(jwt, role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, jwt);
  });
}
