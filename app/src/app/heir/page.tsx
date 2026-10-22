"use client";

import { AccessGate, AppShell } from "@/components/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { useSession } from "@/components/Session";
import { useVaultItems } from "@/components/VaultData";
import { Callout, Card, NextStep, SectionHeader, Stepper, displayName } from "@/components/ui";
import { CompareCard } from "@/components/tide";
import { Icon } from "@/components/Icon";
import { Term } from "@/components/Term";
import { heirRoleForRecord } from "@/lib/records";
import type { Item } from "@/lib/store";
import styles from "./heir.module.css";

const HEIR_ROLES: string[] = Object.values(heirRoleForRecord);

export default function HeirPage() {
  const session = useSession();
  return <AppShell eyebrow="Left for you" title="What Mai left for you" description="Mai named one person for each item. Yours opens only after an independent approver releases it, and the Tide network checks every attempt. Heirloom itself can never open it."><AccessGate allow={["linh", "long"].includes(session.username)}><HeirContent key={session.username} username={session.username} roles={session.roles} /></AccessGate></AppShell>;
}

function HeirContent({ username, roles }: { username: string; roles: string[] }) {
  const { items, loading, error, refresh, client } = useVaultItems();
  const own = items.filter(item => item.recipientUsername === username);
  const others = items.filter(item => item.recipientUsername !== username);
  const releasedOwn = own.filter(item => roles.includes(heirRoleForRecord[item.recordId]));
  const heirRoles = roles.filter(role => HEIR_ROLES.includes(role));
  const otherNames = Array.from(new Set(others.map(item => displayName(item.recipientUsername))));
  const otherWho = otherNames.length === 1 ? otherNames[0] : null;
  return <div className="stack-lg">
    <HeirIntro />
    {loading && <p className="loading-line" role="status">Loading the items Mai left for you…</p>}
    {error && <Callout tone="danger" role="alert" title="Your items could not load"><p>{error}</p><div className="actions"><button className="button-secondary" onClick={refresh}>Reload items</button></div></Callout>}
    {!loading && !error && <div className="stack-lg">
      <div className="grid-2">
        <WhatNext ownCount={own.length} releasedOwn={releasedOwn} heirRoles={heirRoles} />
        <Card as="section" labelledBy="heir-journey-h">
          <h2 id="heir-journey-h" style={{ fontSize: "var(--fs-h3)" }}>How your item reaches you</h2>
          <Stepper label="Your item's progress" steps={[
            { label: "Sealed by Mai", detail: own.length ? "Encrypted in her browser" : "Not yet", state: own.length ? "done" : "current" },
            { label: "Released by a seat", detail: releasedOwn.length ? "Your heir role is in this session" : "Not in this session yet", state: releasedOwn.length ? "done" : own.length ? "current" : "upcoming" },
            { label: "Opened by you", detail: "The Tide network checks your role each time", state: releasedOwn.length ? "current" : "upcoming" },
          ]} />
          <p className="help" style={{ marginTop: "var(--space-4)" }}>In this demo, Mai&apos;s notary is the only seat. In production, two of three independent seats must agree.</p>
        </Card>
      </div>

      <section aria-labelledby="heir-own-h">
        <SectionHeader id="heir-own-h" eyebrow="Addressed to you" title={<>For you <span className="muted">({own.length})</span></>} description="The status comes from the roles in your session. The Tide network checks the item's policy again every time you press Open." />
        {!own.length && <div className="empty-state">Mai has not sealed an item for you yet. When she does, it will appear here, sealed.</div>}
        {!!own.length && !releasedOwn.length && <SignInAgainTip />}
        <div className="item-list">{own.map(item => <ItemCard key={item.id} item={item} access="heir" released={roles.includes(heirRoleForRecord[item.recordId])} open={() => client.openItem(item, "heir")} />)}</div>
      </section>

      {!!others.length && <section aria-labelledby="heir-others-h">
        <SectionHeader id="heir-others-h" eyebrow="Addressed to someone else" title={`For ${otherNames.join(" and ")}`} description={`You can see that ${otherWho ? `${otherWho}'s item` : "each item"} exists, not what it says. A release of your item never unlocks ${otherWho ? "this one" : "these"}.`} />
        <div className="stack">
          <Callout tone="tide" title="Open it anyway">
            <p>Press Open to watch the rule hold. The Tide network checks {otherWho ? `${otherWho}'s` : "the item's"} policy, finds that your session does not hold {otherWho ? `${otherWho}'s` : "that"} heir role, and refuses to release a key.</p>
          </Callout>
          <div className="item-list">{others.map(item => <ItemCard key={item.id} item={item} access="heir" otherRecipient open={() => client.openItem(item, "heir")} />)}</div>
        </div>
      </section>}

      <CompareCard title="An ordinary app vs Heirloom on Tide" description="Why no one at the company, admins included, can open or release Mai's items." rows={[
        { label: "Reading Mai's items", ordinary: "Staff with database access can read them.", tide: "Heirloom stores the contents only as ciphertext and cannot read them." },
        { label: "Releasing an item to you", ordinary: "One admin changes a permission.", tide: "An independent seat approves it in the Tide enclave. Heirloom is not a seat." },
        { label: "Opening someone else's item", ordinary: "Hidden on screen, yet the server could still send it.", tide: "The Tide network refuses to release a key." },
      ]} />
    </div>}
  </div>;
}

/** First-visit orientation: the three things a family member can do on this page. */
function HeirIntro() {
  return <div className={styles.intro}>
    <Callout tone="info" icon="info" title="What you can do here">
      <ol className={styles.list}>
        <li>
          <span className={styles.num} aria-hidden="true">1</span>
          <span className={styles.lead}>See what Mai left for you.</span>
          <span className={styles.text}>Each item names one person. Yours are listed under &ldquo;For you&rdquo;.</span>
        </li>
        <li>
          <span className={styles.num} aria-hidden="true">2</span>
          <span className={styles.lead}>Try to open it.</span>
          <span className={styles.text}>Until a <Term id="seat">seat</Term> releases it, the <Term id="tide-network">Tide network</Term> refuses and shows you why.</span>
        </li>
        <li>
          <span className={styles.num} aria-hidden="true">3</span>
          <span className={styles.lead}>After a release, sign out and in again.</span>
          <span className={styles.text}>Your new <Term id="heir-role">heir role</Term> arrives with your next sign-in. Then your item opens.</span>
        </li>
      </ol>
    </Callout>
  </div>;
}

/** Shown while the recipient's own item is still sealed: the step people miss after a release. */
function SignInAgainTip() {
  const steps = ["A seat approves", "You sign out", "You sign in again", "Press Open"];
  return <div className={styles.tip} role="note" aria-labelledby="heir-signin-tip-h">
    <span className={styles.icon} aria-hidden="true"><Icon name="logOut" size={24} /></span>
    <div>
      <p className={styles.kicker}>Important after a release</p>
      <h3 id="heir-signin-tip-h" className={styles.title}>Released? Sign out, then sign in again</h3>
      <p className={styles.body}>When a <Term id="seat">seat</Term> approves your release, your new <Term id="heir-role">heir role</Term> reaches you only at your next sign-in. Use Sign out at the top of this page, then sign in with Tide.</p>
      <ol className={styles.steps} aria-label="After a release">
        {steps.map((step, i) => <li key={step}>
          <span className={styles.chip}>{step}</span>
          {i < steps.length - 1 && <span className={styles.arrow} aria-hidden="true"><Icon name="chevronRight" size={18} /></span>}
        </li>)}
      </ol>
    </div>
  </div>;
}

/** The one thing to expect next, from the roles in this session only (no guesses about pending requests). */
function WhatNext({ ownCount, releasedOwn, heirRoles }: { ownCount: number; releasedOwn: Item[]; heirRoles: string[] }) {
  const sessionRoles = <div className="cluster">
    <span>Your <Term id="heir-role">heir roles</Term> in this session:</span>
    {heirRoles.length ? heirRoles.map(role => <code className="tag" key={role}>{role}</code>) : <span>none yet</span>}
  </div>;
  if (!ownCount) return <NextStep eyebrow="What happens next" icon="info" title="Nothing has been left for you yet">
    <p>When Mai seals an item for you, it appears here, sealed. You do not need to do anything until then.</p>
  </NextStep>;
  if (releasedOwn.length) return <NextStep icon="unlock" title={releasedOwn.length === 1 ? `${releasedOwn[0].title}: released to you` : "Your items have been released to you"}>
    <p>Press Open on your item below. The Tide network checks your new heir role, then your browser decrypts it. Heirloom&apos;s server never sees the contents.</p>
    {sessionRoles}
  </NextStep>;
  return <NextStep eyebrow="What happens next" icon="clock" title={<>Nothing opens until a <Term id="seat">seat</Term> releases it</>}>
    <p>You will see it here when that happens. Then sign out and back in to receive it.</p>
    {sessionRoles}
  </NextStep>;
}
