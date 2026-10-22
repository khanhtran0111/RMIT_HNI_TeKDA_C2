"use client";

import { useTideCloak } from "@tidecloak/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The provider's init (check-sso, front-channel) already exchanges the "#state=...&code=..." fragment
// for tokens. This page only waits for that and then navigates CLIENT-SIDE: a full reload would drop
// the in-memory session and depend on a silent re-check to get it back.
function safePath(): string {
  try {
    const stored = sessionStorage.getItem("kc_return_url") || "/";
    const u = new URL(stored, window.location.origin);
    // Same-origin only: never follow a returnUrl to another site.
    if (u.origin === window.location.origin && !u.pathname.startsWith("/auth/redirect")) {
      return `${u.pathname}${u.search}`;
    }
  } catch {}
  return "/";
}

export default function AuthRedirectPage() {
  const { isInitializing, authenticated } = useTideCloak();
  const router = useRouter();

  useEffect(() => {
    if (isInitializing) return;
    router.replace(authenticated ? safePath() : "/");
  }, [isInitializing, authenticated, router]);

  return <p>Completing sign-in...</p>;
}
