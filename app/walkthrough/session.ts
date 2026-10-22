// Public walkthrough identity double: stands in for @/components/Session and @tidecloak/nextjs.
// The persona is picked in the walkthrough banner; there is no real sign-in and no Tide network here.
import { createContext } from "react";
import { heldRoles, load, persona, resetAll, setPersona } from "./state";
export const ConfigReadyContext = createContext(true);

type Session = ReturnType<typeof makeSession>;
const sessions = new Map<string, Session>();

function makeSession(username: string, extraRoles: string[]) {
  const roles = username === "mai" ? ["vault-owner-mai", "_tide_encryptor", "_tide_decryptor"]
    : username === "anonymous" ? []
    : ["_tide_decryptor", ...extraRoles];
  const isSeat = username === "notary-duc";
  const resourceAccess = isSeat ? { "realm-management": { roles: ["tide-realm-admin"] } } : {};
  const authenticated = username !== "anonymous";
  return {
    configured: true, authenticated, isInitializing: false, initError: null as Error | null,
    username, roles, isSeat, token: `SIMULATED-${username}`,
    baseURL: window.location.origin,
    async getToken() { return `SIMULATED-${username}`; },
    async secureFetch(url: string, init?: RequestInit) {
      const headers = new Headers(init?.headers); headers.set("X-Walkthrough-Persona", username);
      return fetch(url, { ...init, headers });
    },
    getValueFromIdToken(key: string): unknown { return key === "preferred_username" && authenticated ? username : undefined; },
    getValueFromToken(key: string): unknown {
      if (key === "realm_access") return { roles };
      if (key === "resource_access") return resourceAccess;
      if (key === "preferred_username") return authenticated ? username : undefined;
      if (key === "tideuserkey") return `SIMULATED-PUBLIC-KEY-${username}`;
      return undefined;
    },
    hasRealmRole(role: string) { return roles.includes(role); },
    hasClientRole(role: string, resource?: string) { return isSeat && resource === "realm-management" && role === "tide-realm-admin"; },
    getConfig() { return { "auth-server-url": window.location.origin, realm: "heirloom", resource: "heirloom-client" }; },
    getVendorId() { return "SIMULATED-vendor"; },
    // Stands in for the Tide enclave pop-up: the seat confirms in a browser dialog.
    async approveTideRequests(requests: { id: string; request: Uint8Array }[]) {
      const ok = window.confirm("Simulated Tide enclave\n\nRequested approval: update the roles for a user (release Mai's bank and pension logins to Long).\n\nApprove as Notary Duc?");
      return requests.map(r => ({ id: r.id, approved: ok ? { request: r.request } as { request: Uint8Array } | undefined : undefined, denied: ok ? undefined : true as unknown, pending: undefined as unknown }));
    },
    async login() { setPersona("mai"); window.location.assign("/vault"); },
    async logout() { setPersona("anonymous"); window.location.assign("/"); },
    resetWalkthrough() { resetAll(); window.location.assign("/"); },
  };
}

export function useSession() {
  const username = persona();
  const extra = heldRoles(load(), username);
  const key = `${username}|${extra.join(",")}`;
  let session = sessions.get(key);
  if (!session) { session = makeSession(username, extra); sessions.set(key, session); }
  return session;
}
