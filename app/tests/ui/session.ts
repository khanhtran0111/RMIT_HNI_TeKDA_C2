// Test-only identity double; this module is aliased only by tests/ui/server.ts.
// It stands in for both @/components/Session (useSession) and @tidecloak/nextjs (useTideCloak),
// so a page works in the harness whichever of the two it imports.
// Cast (SPEC "changed 13:25"): notary-duc is the only seat, mai the owner, long the heir.
import { createContext } from "react";
export const ConfigReadyContext = createContext(true);

type Session = ReturnType<typeof makeSession>;
// One object per persona: the real provider memoises its context value, and pages put
// secureFetch / getConfig in effect dependencies, so identities must stay stable across renders.
const sessions = new Map<string, Session>();

function makeSession(username: string, released: boolean) {
  const roles = username === "mai" ? ["vault-owner-mai", "_tide_encryptor", "_tide_decryptor"]
    : username === "anonymous" ? []
    : ["_tide_decryptor", ...(released && username === "long" ? ["heir-bank-mai"] : [])];
  const isSeat = username === "notary-duc";
  const resourceAccess = isSeat ? { "realm-management": { roles: ["tide-realm-admin"] } } : {};
  const authenticated = username !== "anonymous";
  return {
    configured: true, authenticated, isInitializing: false, initError: null as Error | null,
    username, roles, isSeat, token: `TEST-ONLY-${username}`,
    baseURL: window.location.origin,
    async getToken() { return `TEST-ONLY-${username}`; },
    async secureFetch(url: string, init?: RequestInit) {
      const headers = new Headers(init?.headers); headers.set("X-UI-Test-Session", username);
      return fetch(url, { ...init, headers });
    },
    getValueFromIdToken(key: string): unknown { return key === "preferred_username" && authenticated ? username : undefined; },
    getValueFromToken(key: string): unknown {
      if (key === "realm_access") return { roles };
      if (key === "resource_access") return resourceAccess;
      if (key === "preferred_username") return authenticated ? username : undefined;
      if (key === "tideuserkey") return `TEST-PUBLIC-KEY-${username}`;
      return undefined;
    },
    hasRealmRole(role: string) { return roles.includes(role); },
    hasClientRole(role: string, resource?: string) { return isSeat && resource === "realm-management" && role === "tide-realm-admin"; },
    getConfig() { return { "auth-server-url": window.location.origin, realm: "heirloom", resource: "heirloom-client" }; },
    getVendorId() { return "TEST-vendor"; },
    // Stands in for the Tide enclave: approves every request and hands the same bytes back.
    async approveTideRequests(requests: { id: string; request: Uint8Array }[]) {
      return requests.map(r => ({ id: r.id, approved: { request: r.request } as { request: Uint8Array } | undefined, denied: undefined as unknown, pending: undefined as unknown }));
    },
    async login() { window.location.assign("/?as=mai"); },
    async logout() { sessionStorage.clear(); window.location.assign("/?as=anonymous"); },
  };
}

export function useSession() {
  const params = new URLSearchParams(window.location.search);
  const username = params.get("as") ?? sessionStorage.getItem("ui-test-user") ?? "long";
  sessionStorage.setItem("ui-test-user", username);
  const released = params.get("released") === "1";
  const key = `${username}|${released}`;
  let session = sessions.get(key);
  if (!session) { session = makeSession(username, released); sessions.set(key, session); }
  return session;
}
