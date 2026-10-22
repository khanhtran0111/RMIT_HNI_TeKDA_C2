import "./globals.css";
import { Providers } from "./providers";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadTideConfig } from "@/lib/auth/tidecloakConfig";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Heirloom | A decision that stays yours",
  description: "Seal what your family will need. Each item reaches only its named recipient, through a release approved by two independent seats.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = process.env.CLIENT_ADAPTER || existsSync(join(process.cwd(), "data", "tidecloak.json")) ? loadTideConfig() : null;
  return (
    <html lang="en">
      <body>
        <Providers config={config ? { ...config } : null}>{children}</Providers>
      </body>
    </html>
  );
}
