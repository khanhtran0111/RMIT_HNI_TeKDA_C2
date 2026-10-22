// Public walkthrough double for @tidecloak/nextjs: pages that call useTideCloak() get the walkthrough session.
import type { ReactNode } from "react";
import { useSession } from "./session";
export function useTideCloak() { return useSession(); }
export function TideCloakProvider({ children }: { children: ReactNode; config?: unknown }) { return children; }
export function Authenticated({ children }: { children: ReactNode }) { return useSession().authenticated ? children : null; }
export function Unauthenticated({ children }: { children: ReactNode }) { return useSession().authenticated ? null : children; }
export function useAuthCallback() { return { isProcessing: false, error: null }; }
