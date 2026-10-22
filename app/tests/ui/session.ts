// Test-only identity double; this module is aliased only by tests/ui/server.ts.
import { createContext } from "react";
export const ConfigReadyContext = createContext(true);
export function useSession() {
  const params = new URLSearchParams(window.location.search);
  const username = params.get("as") ?? sessionStorage.getItem("ui-test-user") ?? "long";
  sessionStorage.setItem("ui-test-user", username);
  const roles = username === "mai" ? ["vault-owner-mai", "_tide_encryptor", "_tide_decryptor"]
    : username === "ops" ? ["operator"] : ["_tide_decryptor", ...(params.get("released") === "1" && username === "long" ? ["heir-bank-mai"] : [])];
  const isSeat = ["notary-duc", "dr-hanh", "thu"].includes(username);
  return {
    configured: true, authenticated: username !== "anonymous", isInitializing: false, initError: null,
    username, roles, isSeat, token: `TEST-ONLY-${username}`,
    async getToken() { return `TEST-ONLY-${username}`; },
    async secureFetch(url: string, init?: RequestInit) {
      const headers = new Headers(init?.headers); headers.set("X-UI-Test-Session", username);
      return fetch(url, { ...init, headers });
    },
    getValueFromIdToken(key: string) { return key === "preferred_username" ? username : undefined; },
    getValueFromToken(key: string) { return key === "realm_access" ? { roles } : key === "tideuserkey" ? `TEST-PUBLIC-KEY-${username}` : undefined; },
    hasClientRole(role: string, resource?: string) { return isSeat && resource === "realm-management" && role === "tide-realm-admin"; },
    getConfig() { return { "auth-server-url": window.location.origin, realm: "heirloom" }; },
    async login() { window.location.assign("/?as=mai"); },
    async logout() { sessionStorage.clear(); window.location.assign("/?as=anonymous"); },
  };
}
