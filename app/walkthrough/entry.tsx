// Public walkthrough entry: the real Heirloom pages, a simulated backend, and a guided-step banner.
import { createRoot } from "react-dom/client";
import HomePage from "../src/app/page";
import VaultPage from "../src/app/vault/page";
import HeirPage from "../src/app/heir/page";
import OperatorPage from "../src/app/operator/page";
import SeatsPage from "../src/app/seats/page";
import HelpPage from "../src/app/help/page";
import { installMockApi } from "./mockApi";
import { persona, resetAll } from "./state";

installMockApi();

const pages: Record<string, React.ComponentType> = { "/": HomePage, "/vault": VaultPage, "/heir": HeirPage, "/operator": OperatorPage, "/seats": SeatsPage, "/help": HelpPage };
const Page = pages[window.location.pathname] ?? HomePage;

const STEPS = [
  { n: 1, label: "Mai seals her items", href: "/vault?as=mai" },
  { n: 2, label: "Long searches the server dump", href: "/operator?as=long" },
  { n: 3, label: "Long tries to open", href: "/heir?as=long" },
  { n: 4, label: "Notary Duc releases", href: "/seats?as=notary-duc" },
  { n: 5, label: "Long, after the release", href: "/heir?as=long" },
];
const WHO: Record<string, string> = { mai: "Mai (owner)", long: "Long (son)", "notary-duc": "Notary Duc (seat)", anonymous: "signed out" };

function Banner() {
  const me = persona();
  const here = `${window.location.pathname}`;
  return (
    <div style={{ background: "#0F5F66", color: "#fff", font: "500 14px/1.4 'Noto Sans', system-ui, sans-serif", padding: "10px 16px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "8px 16px", alignItems: "center" }}>
        <strong style={{ letterSpacing: ".04em" }}>INTERACTIVE WALKTHROUGH</strong>
        <span style={{ opacity: .9 }}>Simulated Tide responses. The real run against TideCloak and the live Tide network is in the demo video.</span>
        <span style={{ marginLeft: "auto", opacity: .9 }}>Viewing as <strong>{WHO[me] ?? me}</strong></span>
      </div>
      <nav aria-label="Walkthrough steps" style={{ maxWidth: 1200, margin: "8px auto 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
        {STEPS.map(s => {
          const active = s.href.startsWith(here + "?") && s.href.includes(`as=${me}`);
          return <a key={s.n} href={s.href} style={{ color: active ? "#0F5F66" : "#fff", background: active ? "#fff" : "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.35)", borderRadius: 999, padding: "4px 12px", textDecoration: "none", whiteSpace: "nowrap" }}>{s.n}. {s.label}</a>;
        })}
        <button onClick={() => { resetAll(); window.location.assign("/"); }} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.5)", borderRadius: 999, padding: "4px 12px", cursor: "pointer", font: "inherit", minHeight: 0 }}>Start over</button>
      </nav>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<><Banner /><Page /></>);
