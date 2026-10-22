"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SyntheticBadge } from "./SyntheticBadge";
import { useSession } from "./Session";

export function AppShell({ children, title, eyebrow, description }: { children: React.ReactNode; title: string; eyebrow: string; description?: string }) {
  const session = useSession();
  const path = usePathname();
  const [authError, setAuthError] = useState("");
  const links = [{ href: "/", label: "Home", show: true },
    { href: "/vault", label: "My vault", show: session.roles.includes("vault-owner-mai") },
    { href: "/heir", label: "For me", show: ["linh", "long"].includes(session.username) },
    { href: "/operator", label: "Operator view", show: session.roles.includes("operator") },
    { href: "/seats", label: "Independent seats", show: session.isSeat },
    { href: "/setup", label: "Setup", show: session.isSeat }];
  async function signOut() { try { await session.logout(); } catch { setAuthError("Sign-out could not complete. Try signing out again."); } }
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header"><div className="header-inner">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">h.</span> Heirloom</Link>
      <nav aria-label="Main navigation">{links.filter(link => link.show).map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined}>{link.label}</Link>)}</nav>
      <div className="header-account"><SyntheticBadge />{session.authenticated && <><span>{session.username}</span><button className="button-quiet" onClick={signOut}>Sign out</button></>}</div>
    </div></header>
    <main id="main" className="page-shell"><div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{authError && <p role="alert">{authError}</p>}{children}</main>
    <footer className="app-footer"><span>Decided by Mai. Sealed with Tide.</span><span>Two independent seats to release. One named recipient per item.</span></footer>
  </>;
}

export function AccessGate({ children, allow = true }: { children: React.ReactNode; allow?: boolean }) {
  const session = useSession();
  const [error, setError] = useState("");
  if (!session.configured) return <section className="notice"><h2>Waiting for vault setup</h2><p>Dev A’s TideCloak configuration has not been connected. Sign-in becomes available when the private adapter is added.</p><p className="muted">No vault data is loaded before sign-in.</p></section>;
  if (session.isInitializing) return <p role="status">Connecting to your Tide session…</p>;
  if (session.initError) return <section className="notice" role="alert"><h2>Sign-in could not initialize</h2><p>{session.initError.message}</p><p>Open Heirloom in Chrome or Edge and allow sign-in pop-ups.</p></section>;
  if (!session.authenticated) return <section className="notice"><h2>Sign in to continue</h2><p>Your Tide identity determines which page you can use.</p><button onClick={() => { session.login().catch(() => setError("Sign-in could not start. Check pop-up permissions and try again.")); }}>Sign in with Tide</button>{error && <p role="alert">{error}</p>}</section>;
  if (!allow) return <section className="notice" role="alert"><h2>This page belongs to another role</h2><p>Signed in as <strong>{session.username}</strong>. Return home to see your pages.</p><Link className="button button-secondary" href="/">Return home</Link></section>;
  return <>{children}</>;
}
