"use client";

import { TideCloakProvider } from "@tidecloak/nextjs";
import { ConfigReadyContext } from "@/components/Session";

// The provider takes the adapter JSON directly as the config prop.
// useDPoP goes inside the config object, not as a separate JSX prop (I-12).
export function Providers({ children, config }: { children: React.ReactNode; config: Record<string, unknown> | null }) {
  const configured = config !== null;
  if (!configured) return <ConfigReadyContext.Provider value={false}>{children}</ConfigReadyContext.Provider>;
  return (
    <ConfigReadyContext.Provider value>
    <TideCloakProvider
      config={{ ...config, useDPoP: { mode: "strict", alg: "ES256" } }}
    >
      {children}
    </TideCloakProvider>
    </ConfigReadyContext.Provider>
  );
}
