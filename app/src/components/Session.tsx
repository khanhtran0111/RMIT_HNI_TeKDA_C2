"use client";

import { createContext, useContext } from "react";
import { useTideCloak } from "@tidecloak/nextjs";

export const ConfigReadyContext = createContext(false);
export function useSession() {
  const auth = useTideCloak();
  const configured = useContext(ConfigReadyContext);
  const username = String(auth.getValueFromIdToken("preferred_username") ?? auth.getValueFromToken("preferred_username") ?? "");
  const realm = auth.getValueFromToken("realm_access") as { roles?: unknown } | undefined;
  const roles = Array.isArray(realm?.roles) ? realm.roles.filter((role): role is string => typeof role === "string") : [];
  return { ...auth, configured, username, roles, isSeat: auth.hasClientRole("tide-realm-admin", "realm-management"), isInitializing: configured && auth.isInitializing };
}
