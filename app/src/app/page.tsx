"use client";

import Link from "next/link";
import { AccessGate, AppShell } from "@/components/AppShell";
import { useSession } from "@/components/Session";

export default function HomePage() {
  const session = useSession();
  const links = [
    { href: "/vault", title: "My vault →", copy: "Seal or re-read the items you chose for your family.", show: session.roles.includes("vault-owner-mai") },
    { href: "/heir", title: "From Mai, for you →", copy: "See what was addressed to you and try to open it.", show: ["linh", "long"].includes(session.username) },
    { href: "/operator", title: "Server dump →", copy: "Inspect every stored byte and test your access.", show: session.authenticated },
    { href: "/seats", title: "Independent seats →", copy: "Review the rules and approve releases with another seat.", show: session.isSeat },
    { href: "/setup", title: "Policy setup →", copy: "Sign each record’s owner and heir policies.", show: session.isSeat },
  ].filter(link => link.show);
  return <AppShell eyebrow="A decision that stays yours" title="For the people you choose." description="While Mai can still decide, she seals what her family will need. Bank and pension logins for Long. Care wishes remain sealed to other recipients in this demo.">
    <div className="home-intro"><section><h2>Mai chooses. Long receives only his item.</h2><p className="muted">Heirloom stores only ciphertext. This licence-limited demo has three accounts: Mai, Long and one notary seat. The notary’s approval releases Long’s bank item. Production uses two of three independent seats; this demo does not demonstrate that quorum.</p>
      <AccessGate>{session.authenticated && <section aria-label="Your identity"><h3>Signed in as {session.username}</h3><p className="help">Realm roles in your current session</p><div className="identity">{session.roles.length ? session.roles.map(role => <code key={role}>{role}</code>) : <span className="muted">No realm roles</span>}</div>{session.isSeat && <p className="help">Client role: realm-management / tide-realm-admin</p>}<div className="page-links">{links.map(link => <Link className="page-link" href={link.href} key={link.href}><strong>{link.title}</strong><span className="help">{link.copy}</span></Link>)}</div>{!links.length && <p className="notice">Your identity has no page role yet. Ask a seat to complete setup, then sign out and back in.</p>}</section>}</AccessGate>
    </section><aside aria-label="Rules of the vault"><p className="eyebrow">The rules of this vault</p><ol className="vault-rules"><li><strong>01 / Mai chooses</strong><span className="muted">One named recipient for every item. Encrypted in her browser.</span></li><li><strong>02 / A seat approves the demo</strong><span className="muted">One notary account, threshold 1. Production requires two of three independent seats.</span></li><li><strong>03 / Only their item opens</strong><span className="muted">The Tide network checks the item’s policy on every open request.</span></li></ol><p className="help" style={{ marginTop: 24 }}>All people, care wishes and account details in this prototype are fictional.</p></aside></div>
  </AppShell>;
}
