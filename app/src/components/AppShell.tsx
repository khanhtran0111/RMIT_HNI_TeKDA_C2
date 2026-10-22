"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SyntheticBadge } from "./SyntheticBadge";
import { useSession } from "./Session";
import { BrandMark, Icon } from "./Icon";
import { Person } from "./ui";

export function AppShell({ children, title, eyebrow, description }: { children: React.ReactNode; title: string; eyebrow: string; description?: string }) {
  const session = useSession();
  const path = usePathname();
  const [authError, setAuthError] = useState("");
  const links = [{ href: "/", label: "Home", show: true },
    { href: "/vault", label: "My vault", show: session.roles.includes("vault-owner-mai") },
    { href: "/heir", label: "For me", show: ["linh", "long"].includes(session.username) },
    { href: "/operator", label: "Server dump", show: session.authenticated },
    { href: "/seats", label: "Independent seats", show: session.isSeat },
    { href: "/setup", label: "Setup", show: session.isSeat },
    { href: "/help", label: "How it works", show: true }];
  const roleLine = session.roles.includes("vault-owner-mai") ? "Vault owner" : session.isSeat ? "Approver seat" : ["linh", "long"].includes(session.username) ? "Family member" : "Signed in";
  async function signOut() { try { await session.logout(); } catch { setAuthError("Sign-out could not complete. Try signing out again."); } }
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header"><div className="header-inner">
      <Link className="brand" href="/"><span className="brand-mark"><BrandMark size={32} /></span>Heirloom</Link>
      <nav className="app-nav" aria-label="Main navigation">{links.filter(link => link.show).map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined}>{link.label}</Link>)}</nav>
      <div className="header-account"><SyntheticBadge />{session.authenticated && <><span className="account-chip"><Person name={session.username} role={roleLine} size="sm" /></span><button className="button-quiet button-sm" onClick={signOut}><Icon name="logOut" size={16} />Sign out</button></>}</div>
    </div></header>
    <main id="main" className="page-shell"><div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{authError && <p className="page-alert" role="alert">{authError}</p>}{children}</main>
    <footer className="app-footer"><span className="footer-brand"><BrandMark size={20} />Decided by Mai. Sealed with Tide.</span><span>Demo: one notary seat. Production: two of three independent seats.</span></footer>
  </>;
}

export function AccessGate({ children, allow = true }: { children: React.ReactNode; allow?: boolean }) {
  const session = useSession();
  const [error, setError] = useState("");
  if (!session.configured) return <section className="gate"><span className="gate-icon"><Icon name="server" size={24} /></span><h2>Waiting for vault setup</h2><p>This Heirloom instance is not connected to its Tide sign-in service yet. Sign-in becomes available as soon as setup is complete.</p><p className="help">No vault data is loaded before sign-in.</p></section>;
  if (session.isInitializing) return <p className="loading-line" role="status">Connecting to your Tide session…</p>;
  if (session.initError) return <section className="gate gate-alert" role="alert"><span className="gate-icon"><Icon name="alert" size={24} /></span><h2>Sign-in could not initialize</h2><p>{session.initError.message}</p><p className="help">Open Heirloom in Chrome or Edge and allow sign-in pop-ups.</p></section>;
  if (!session.authenticated) return <section className="gate"><span className="gate-icon"><Icon name="key" size={24} /></span><h2>Sign in to continue</h2><p>Your Tide identity decides which pages and items you can use. Heirloom never sees your password.</p><div className="actions"><button className="button-lg" onClick={() => { session.login().catch(() => setError("Sign-in could not start. Check pop-up permissions and try again.")); }}><Icon name="key" size={18} />Sign in with Tide</button></div>{error && <p className="help" role="alert">{error}</p>}</section>;
  if (!allow) return <section className="gate gate-alert" role="alert"><span className="gate-icon"><Icon name="shieldX" size={24} /></span><h2>This page belongs to another role</h2><p>Signed in as <strong>{session.username}</strong>. Return home to see your pages.</p><div className="actions"><Link className="button button-secondary" href="/">Return home</Link></div></section>;
  return <>{children}</>;
}
