"use client";

import { useAuthCallback } from "@tidecloak/nextjs";
import { useEffect, useState } from "react";

// Separated so useAuthCallback only runs after hydration (avoids SSR window error).
function RedirectHandler() {
  const { isProcessing, isSuccess, error } = useAuthCallback({
    onSuccess: (returnUrl) => {
      // Same-origin only: never follow a returnUrl to another site.
      let target = "/";
      try {
        const u = new URL(returnUrl || "/", window.location.origin);
        // Use the full validated URL: a reassembled "//host/..." path would be protocol-relative.
        if (u.origin === window.location.origin) target = u.href;
      } catch {}
      window.location.assign(target);
    },
    onError: () => {
      window.location.assign("/");
    },
    onMissingVerifierRedirectTo: "/",
  });

  useEffect(() => {
    // If this page is loaded without callback params (direct navigation),
    // redirect to home.
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error")) {
      window.location.assign("/");
    }
  }, []);

  if (error) {
    return <p>Authentication failed: {error.message}</p>;
  }

  if (isProcessing || !isSuccess) {
    return <p>Completing login...</p>;
  }

  return <p>Redirecting...</p>;
}

export default function AuthRedirectPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <p>Loading...</p>;
  return <RedirectHandler />;
}
