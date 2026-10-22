// Test-only double for @tidecloak/nextjs (aliased by tests/ui/server.ts). Pages that still call
// useTideCloak() get the same mock session object as useSession().
import type { ReactNode } from "react";
import { useSession } from "./session";
export function useTideCloak() { return useSession(); }
export function TideCloakProvider({ children }: { children: ReactNode; config?: unknown }) { return children; }
export function Authenticated({ children }: { children: ReactNode }) { return useSession().authenticated ? children : null; }
export function Unauthenticated({ children }: { children: ReactNode }) { return useSession().authenticated ? null : children; }
export function useAuthCallback() { return { isProcessing: false, error: null }; }
