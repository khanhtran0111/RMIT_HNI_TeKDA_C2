"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { AccessGate, AppShell } from "@/components/AppShell";
import { Icon, type IconName } from "@/components/Icon";
import { useSession } from "@/components/Session";
import { Term } from "@/components/Term";
import { CompareCard, NodeGrid, TIDE_NETWORK } from "@/components/tide";
import { Callout, Card, NextStep, Person, SectionHeader, displayName } from "@/components/ui";
import styles from "./home.module.css";

// Layout comes from the shared catalog classes; these token-only inline styles cover the few
// home-specific details. The story section ("The story in 4 steps") has its own home.module.css.
const listReset: CSSProperties = { listStyle: "none", margin: 0, padding: 0 };
const iconCircle: CSSProperties = { display: "inline-grid", placeItems: "center", width: 48, height: 48, borderRadius: "50%", background: "var(--tide-tint)", color: "var(--primary)", marginBottom: "var(--space-3)" };
const linkRow: CSSProperties = { display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: "var(--space-3)", alignItems: "center" };
const linkIcon: CSSProperties = { display: "inline-grid", placeItems: "center", width: 40, height: 40, borderRadius: "var(--radius)", background: "var(--tide-tint)", color: "var(--primary)" };

// The constant is this network's threshold, never an observed result, so the caption says so.
const NETWORK_CHECK = `Every open request is checked by ${TIDE_NETWORK.required} of ${TIDE_NETWORK.total} independent Tide nodes on ${TIDE_NETWORK.label}`;

const STEPS: { icon: IconName; title: string; copy: string }[] = [
  { icon: "lock", title: "Seal in your browser", copy: "Each item is encrypted on your device before it is saved. Heirloom stores the content only as ciphertext: scrambled data it cannot read." },
  { icon: "send", title: "Name who receives each item", copy: "Every item has one named recipient. Your son opens what you left for him, and nothing addressed to anyone else." },
  { icon: "scale", title: "Released only when independent seats agree", copy: "A seat is an independent approver, such as a notary or a family doctor. Heirloom is never a seat." },
];

const COMPARE = [
  { label: "Reading your items", ordinary: "The company can read your vault.", tide: "The company holds the contents only as ciphertext, with no key to open them." },
  // The honest qualifier sits on the claim it qualifies; the footer repeats the demo note on every page.
  { label: "Handing them over", ordinary: "One admin can hand it over to anyone.", tide: <>No single person or company can release it. Independent seats must approve.<span className="help" style={{ display: "block", marginTop: 4 }}>This demo uses one notary seat. Production uses two of three.</span></> },
  { label: "Who receives what", ordinary: "A timer guesses you are gone and sends everything.", tide: "Each item opens only for its named recipient. The Tide network checks every request." },
];

// "The story in 4 steps": the demo path every visitor can follow, one demo account per step.
// Presentational only: it reads the session to mark the visitor's own step and links to that page.
type StoryTone = "sealed" | "refused" | "tide" | "released";
type StoryStep = { n: 1 | 2 | 3 | 4; actor: "mai" | "long" | "notary-duc"; actorRole: string; title: string; tone: StoryTone; icon: IconName; result: ReactNode; path: ReactNode[]; action: { href: string; label: string } };

const STORY: StoryStep[] = [
  {
    n: 1, actor: "mai", actorRole: "Owner", title: "Mai seals her items", tone: "sealed", icon: "lock",
    result: <>Each item is encrypted in her browser, with one named recipient. Heirloom stores only scrambled text.</>,
    path: [<>Sign in as <code>mai</code></>, <>Go to <strong>My vault</strong></>, <>Press <strong>Seal demo items</strong></>],
    action: { href: "/vault", label: "Go to My vault" },
  },
  {
    n: 2, actor: "long", actorRole: "Her son", title: "Long tries and is refused", tone: "refused", icon: "shieldX",
    result: <>The <Term id="tide-network">Tide network</Term> refuses to open his item. TideCloak refuses the release too: Long is not a seat.</>,
    path: [<>Sign in as <code>long</code></>, <>Go to <strong>Server dump</strong></>, <>Press <strong>Try to open</strong>, then <strong>Try to release to Long</strong></>],
    action: { href: "/operator", label: "Go to the server dump" },
  },
  {
    n: 3, actor: "notary-duc", actorRole: "Seat", title: "Notary Duc releases", tone: "tide", icon: "scale",
    result: <>TideCloak only files the request. Duc approves it in the <Term id="enclave">Tide enclave</Term>, outside Heirloom.</>,
    path: [<>Sign in as <code>notary-duc</code></>, <>Go to <strong>Independent seats</strong></>, <>Press <strong>Release bank logins to Long</strong>, then approve</>],
    action: { href: "/seats", label: "Go to Independent seats" },
  },
  {
    n: 4, actor: "long", actorRole: "Her son", title: "Long opens his item only", tone: "released", icon: "unlock",
    result: <>The bank logins open in his browser. His sister&rsquo;s care wishes stay refused.</>,
    path: [<>Sign out, then sign in as <code>long</code> again</>, <>Go to <strong>For me</strong></>, <>Press <strong>Open</strong> on the bank logins</>],
    action: { href: "/heir", label: "Go to your items" },
  },
];

const CAST: { username: string; role: string; text: ReactNode }[] = [
  { username: "mai", role: "Owner, 68", text: "Seals each item while she can still decide." },
  { username: "long", role: "Her son", text: "Receives the bank and pension logins." },
  { username: "linh", role: "Her daughter", text: "Receives the care wishes. No account in this demo." },
  { username: "notary-duc", role: "Seat", text: <>The only <Term id="seat">seat</Term> in this demo. Approves releases, cannot read.</> },
];

type Persona = "owner" | "heir" | "seat" | "member";
type PageLink = { href: string; title: string; copy: string; icon: IconName; show: boolean };

export default function HomePage() {
  const session = useSession();
  const [signInError, setSignInError] = useState("");
  const allLinks: PageLink[] = [
    { href: "/vault", title: "My vault", copy: "Seal items and choose who receives each one.", icon: "lock", show: session.roles.includes("vault-owner-mai") },
    { href: "/heir", title: "From Mai, for you", copy: "See what Mai addressed to you and try to open it.", icon: "fileText", show: ["linh", "long"].includes(session.username) },
    { href: "/operator", title: "Server dump", copy: "See every byte Heirloom stores, then try to open it.", icon: "server", show: session.authenticated },
    { href: "/seats", title: "Independent seats", copy: "Review the rules, then file and approve releases.", icon: "scale", show: session.isSeat },
    { href: "/setup", title: "Policy setup", copy: "Sign the rules (policies) the Tide network checks.", icon: "shieldCheck", show: session.isSeat },
  ];
  const links = allLinks.filter(link => link.show);

  // Same sign-in call and states as AccessGate; the front door shows it as its one primary action.
  const canSignIn = session.configured && !session.isInitializing && !session.initError && !session.authenticated;
  function signIn() { session.login().catch(() => setSignInError("Sign-in could not start. Allow pop-ups for this site, then sign in again.")); }

  const persona: Persona = session.roles.includes("vault-owner-mai") ? "owner" : session.isSeat ? "seat" : ["linh", "long"].includes(session.username) ? "heir" : "member";
  const name = session.username ? displayName(session.username) : "";
  const roleLine = { owner: "Vault owner", seat: "Approver seat", heir: "Family member", member: "Signed in" }[persona];
  const story = {
    owner: {
      eyebrow: "Vault owner",
      description: "You decide who receives each item, while you can still decide. Heirloom cannot read or release anything you seal.",
      next: { icon: "lock" as IconName, title: "Seal what your family will need", body: "Name one recipient for each item. It is encrypted in your browser before Heirloom stores it.", href: "/vault", action: "Open my vault" },
      tide: "Heirloom never holds a whole key, so it cannot open what you seal.",
    },
    heir: {
      eyebrow: session.username === "linh" ? "Mai's daughter" : "Mai's son",
      description: "Mai named you as the recipient of one item. It opens for you only after an independent approver releases it.",
      next: { icon: "fileText" as IconName, title: "See what Mai left for you", body: "It stays sealed until a seat approves the release, and Heirloom cannot override that. After a release, sign out and back in to receive it.", href: "/heir", action: "Open my items" },
      tide: "When you open an item, the nodes check that you are its named recipient. Heirloom cannot change their answer.",
    },
    seat: {
      eyebrow: "Independent seat",
      description: "You are a seat: an independent approver Mai chose. You can approve a release, but you cannot read what is sealed.",
      next: { icon: "scale" as IconName, title: "Review release requests", body: "File a release, then approve it in the Tide enclave, a secure Tide window where only you can sign. Heirloom cannot approve for you.", href: "/seats", action: "Review requests" },
      tide: "Your approval grants a role. The nodes still check that role before any key is released.",
    },
    member: {
      eyebrow: "Signed in",
      description: "Your Tide identity has no role in this vault yet. You can still see what Heirloom stores.",
      next: { icon: "server" as IconName, title: "See what Heirloom stores", body: "Every byte the company holds, and what happens when anyone tries to open it.", href: "/operator", action: "Open the server dump" },
      tide: "Heirloom never holds a whole key, so even its own server cannot open an item.",
    },
  }[persona];

  // The visitor's own step: Long plays step 2 until a seat releases his item, then step 4.
  const myStep = !session.authenticated ? 0
    : persona === "owner" ? 1
    : persona === "seat" ? 3
    : session.username === "long" ? (session.roles.includes("heir-bank-mai") ? 4 : 2)
    : 0;
  const storyDescription = !session.authenticated
    ? "Each step uses a different demo account. Together they show that no one alone can open Mai\u2019s items: not Heirloom, not her son, not one admin."
    : myStep ? `You are signed in as ${name}. Your step is marked below.`
    : "Your account has no step in this story. To play one, sign out, then sign in as mai, long or notary-duc.";

  const storySection = <section className={styles.story} aria-labelledby="home-story">
    <SectionHeader id="home-story" eyebrow="Try it yourself" title="The story in 4 steps" description={storyDescription}
      action={<Link className="button button-secondary" href="/help"><Icon name="info" size={18} />Read how Heirloom works</Link>} />
    <h3 className={styles.castTitle} id="home-cast">Who&rsquo;s who</h3>
    <ul className={styles.cast} aria-labelledby="home-cast">
      {CAST.map(person => <li className={styles.castItem} key={person.username}>
        <span className={styles.castHead}>
          <Person name={person.username} role={person.role} size="sm" />
          {session.authenticated && session.username === person.username && <span className={styles.you}>You</span>}
        </span>
        <p className={styles.castText}>{person.text}</p>
      </li>)}
    </ul>
    <ol className={styles.steps} aria-label="The story in 4 steps">
      {STORY.map(step => {
        const mine = myStep === step.n;
        const alsoMine = !mine && session.authenticated && session.username === step.actor;
        return <li key={step.n} className={`${styles.step} ${styles[step.tone]}${mine ? ` ${styles.mine}` : ""}`} aria-current={mine ? "step" : undefined}>
          {mine && <span className={styles.tag}><Icon name="user" size={14} strokeWidth={2.5} />Your step</span>}
          {alsoMine && <span className={`${styles.tag} ${styles.tagSoft}`}>Also you</span>}
          <div className={styles.stepHead}>
            <span className={styles.num} aria-hidden="true">{step.n}</span>
            <Person name={step.actor} role={step.actorRole} size="sm" />
          </div>
          <h3 className={styles.stepTitle}><span className="sr-only">Step {step.n}: </span>{step.title}</h3>
          <p className={styles.result}><Icon name={step.icon} size={18} /><span>{step.result}</span></p>
          <div className={styles.how}>
            <p className={styles.howLabel} id={`home-story-how-${step.n}`}>Try it</p>
            <ol className={styles.path} aria-labelledby={`home-story-how-${step.n}`}>
              {step.path.map((part, i) => <li className={styles.pathItem} key={i}><Icon name="chevronRight" size={16} /><span>{part}</span></li>)}
            </ol>
          </div>
          {mine && <div className={styles.action}><Link className="button" href={step.action.href}>{step.action.label}<Icon name="arrowRight" size={18} /></Link></div>}
        </li>;
      })}
    </ol>
    <p className={`help ${styles.note}`}>Each step uses a different account: sign out, then sign in as the next person. A newly granted role arrives at the next sign-in.</p>
  </section>;

  const howItWorks = <section aria-labelledby="home-how">
    <SectionHeader id="home-how" eyebrow="How it works" title="Three steps, decided by you" />
    <ol className="grid-3" style={listReset}>
      {STEPS.map((step, i) => <Card as="li" key={step.title}>
        <span style={iconCircle}><Icon name={step.icon} size={24} /></span>
        <p className="eyebrow">Step {i + 1}</p>
        <h3>{step.title}</h3>
        <p className="muted">{step.copy}</p>
      </Card>)}
    </ol>
  </section>;

  if (!session.authenticated) {
    return <AppShell eyebrow="For families planning ahead" title="Decide today who receives what, when you no longer can." description="Heirloom lets you seal what your family will need and name one person for each item. The company cannot read it, and it is released only when independent approvers agree.">
      <div className="stack-lg">
        <div className="grid-2">
          {canSignIn ? <Card as="section" labelledBy="home-signin">
            <span style={iconCircle}><Icon name="key" size={24} /></span>
            <h2 id="home-signin">Sign in to get started</h2>
            <p className="muted">Your Tide identity decides what you can do here: seal items, open what was left for you, or approve a release. Heirloom never sees your password.</p>
            <div className="actions"><button className="button-lg" onClick={signIn}><Icon name="key" size={18} />Sign in with Tide</button></div>
            {signInError && <p className="help" role="alert" style={{ marginTop: "var(--space-2)" }}>{signInError}</p>}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: "var(--space-4)", paddingTop: "var(--space-3)" }}>
              <p className="help" style={{ marginBottom: "var(--space-2)" }}>Demo accounts. All people, care wishes and account details are fictional.</p>
              <ul className="cluster" style={{ ...listReset, gap: "var(--space-2) var(--space-4)" }}>
                <li><Person name="mai" role="Owner" size="sm" /></li>
                <li><Person name="long" role="Her son" size="sm" /></li>
                <li><Person name="notary-duc" role="Independent approver" size="sm" /></li>
              </ul>
            </div>
          </Card> : <AccessGate>{null}</AccessGate>}
          <Card as="aside" labelledBy="home-network">
            <p className="eyebrow with-icon"><Icon name="network" size={16} />The Tide network</p>
            <h2 id="home-network">Independent nodes guard every key</h2>
            <NodeGrid state="idle" headline={NETWORK_CHECK} />
            <p className="help" style={{ marginTop: "var(--space-4)" }}>Heirloom never holds a whole key, so its own staff cannot open what you seal.</p>
          </Card>
        </div>
        {storySection}
        {howItWorks}
        <CompareCard title="Why it is different" description="An ordinary app asks you to trust its company and its admins. Heirloom on Tide removes that power, including from Heirloom itself." rows={COMPARE} />
      </div>
    </AppShell>;
  }

  return <AppShell eyebrow={story.eyebrow} title={name ? `Welcome, ${name}.` : "Welcome."} description={story.description}>
    <AccessGate>
      <div className="stack-lg">
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="stack">
            <NextStep icon={story.next.icon} title={story.next.title} action={<Link className="button" href={story.next.href}>{story.next.action}<Icon name="arrowRight" size={18} /></Link>}>{story.next.body}</NextStep>
            <section aria-labelledby="home-pages">
              <SectionHeader id="home-pages" title="Your pages" description="What your Tide identity lets you do." />
              <div className="page-links" style={{ gridTemplateColumns: "1fr", marginTop: 0 }}>
                {links.map(link => <Link className="page-link" style={linkRow} href={link.href} key={link.href}>
                  <span style={linkIcon}><Icon name={link.icon} /></span>
                  <span style={{ display: "grid", minWidth: 0 }}><strong>{link.title}</strong><span className="help">{link.copy}</span></span>
                  <span style={{ color: "var(--text-muted)" }}><Icon name="chevronRight" /></span>
                </Link>)}
              </div>
              {!links.length && <Callout tone="warning" title="No pages yet">Your identity has no page role yet. Ask a seat to complete setup, then sign out and back in.</Callout>}
            </section>
          </div>
          <div className="stack">
            <Card as="section" label="Your identity">
              <p className="eyebrow">Signed in with Tide</p>
              <Person name={session.username} role={roleLine} size="lg" />
              <p className="help" style={{ margin: "var(--space-3) 0 0" }}>Roles in your current session</p>
              <div className="identity">{session.roles.length ? session.roles.map(role => <code key={role}>{role}</code>) : <span className="muted">No roles yet</span>}</div>
              {session.isSeat && <p className="help">Client role: realm-management / tide-realm-admin</p>}
              <p className="help">Roles come from your Tide sign-in. A newly granted role arrives the next time you sign in.</p>
            </Card>
            <Card as="aside" label="The Tide network">
              <p className="eyebrow with-icon"><Icon name="network" size={16} />The Tide network</p>
              <NodeGrid state="idle" compact headline={NETWORK_CHECK} />
              <p className="help" style={{ marginTop: "var(--space-3)" }}>{story.tide}</p>
            </Card>
          </div>
        </div>
        {storySection}
        {howItWorks}
      </div>
    </AccessGate>
  </AppShell>;
}
