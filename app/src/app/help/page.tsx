// /help: "How Heirloom works". Public: no AccessGate, no data calls, no Tide calls.
// Every claim here stays inside the verified facts (one seat in this prototype, 2 of 3 in production;
// 14 of 20 Tide nodes; Heirloom is never a seat). The glossary list is rendered from lib/glossary.ts.
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon, type IconName } from "@/components/Icon";
import { Term } from "@/components/Term";
import { CompareCard, TIDE_NETWORK, type CompareRow } from "@/components/tide";
import { Callout, Person, SectionHeader } from "@/components/ui";
import { GLOSSARY } from "@/lib/glossary";
import styles from "./help.module.css";

export const metadata = {
  title: "How Heirloom works | Heirloom",
  description: "Who can read and release what in Heirloom, what Tide changes, what comes next, and what to try first.",
};

const SECTIONS = [
  { id: "in-one-minute", label: "In one minute" },
  { id: "who-can", label: "Who can do what" },
  { id: "compare", label: "Ordinary app vs Heirloom" },
  { id: "next", label: "What comes next" },
  { id: "judges", label: "For judges" },
  { id: "glossary", label: "Glossary" },
];

type AnswerKind = "yes" | "later" | "no";
type Answer = { kind: AnswerKind; word: string; detail: ReactNode };
const ANSWER_ICON: Record<AnswerKind, IconName> = { yes: "check", later: "clock", no: "x" };

const WHO: { username: string; role: string; read: Answer; release: Answer }[] = [
  {
    username: "mai", role: "Owner",
    read: { kind: "yes", word: "Yes", detail: "Her own items, any time." },
    release: { kind: "no", word: "No", detail: "She chooses each item’s recipient while she can still decide." },
  },
  {
    username: "long", role: "Her son",
    read: { kind: "later", word: "After a release", detail: "Only the bank and pension logins." },
    release: { kind: "no", word: "No", detail: "TideCloak answers 403: not a seat." },
  },
  {
    username: "linh", role: "Her daughter (no account here)",
    read: { kind: "later", word: "After a release", detail: "Only the care wishes. She has no account in this demo." },
    release: { kind: "no", word: "No", detail: "Only a seat can release." },
  },
  {
    username: "notary-duc", role: "Seat",
    read: { kind: "no", word: "No", detail: "The Tide network refuses him too." },
    release: { kind: "yes", word: "Yes", detail: <>He approves in the <Term id="enclave">Tide enclave</Term>, outside Heirloom.</> },
  },
  {
    username: "heirloom", role: "The company",
    read: { kind: "no", word: "No", detail: "It stores only ciphertext." },
    release: { kind: "no", word: "No", detail: "It is never a seat." },
  },
];

const COMPARE: CompareRow[] = [
  { label: "Who can read your items", ordinary: "The company, its admins, and anyone who copies the database.", tide: "No one at Heirloom. Items are encrypted in your browser, and the server keeps only ciphertext." },
  { label: "Who can hand them over", ordinary: "One admin, one support agent, or one relative with emergency access.", tide: <>Only a seat, approving in the Tide enclave. TideCloak files the request but cannot grant it alone.<span className="help" style={{ display: "block", marginTop: 4 }}>This demo uses one notary seat. Production uses two of three.</span></> },
  { label: "Who receives what", ordinary: "Often the whole vault goes to one person.", tide: "Each item has its own recipient. Long’s role does not open his sister’s care wishes." },
  { label: "If the owner can no longer object", ordinary: "A timer releases everything after months of silence.", tide: "People decide: the seats she chose, backed by a document (mocked in this demo)." },
  { label: "If someone takes over the server", ordinary: "They can read the vault or change who gets it.", tide: `They get ciphertext. ${TIDE_NETWORK.required} of ${TIDE_NETWORK.total} Tide nodes still refuse to release a key without the right role.` },
];

const NEXT: { icon: IconName; title: string; body: string; today: string; ready: boolean }[] = [
  { icon: "users", title: "Two of three independent seats", body: "A notary, a family doctor and a relative. Any two must agree. The company is never a seat.", today: "Today: one seat, Notary Duc", ready: false },
  { icon: "server", title: "A company that can neither read nor release", body: "Heirloom stores ciphertext. It holds no whole key and has no vote on a release.", today: "Works in this prototype", ready: true },
  { icon: "send", title: "A recipient for every item", body: "Letters for a daughter, a business account for a partner, medical wishes for the doctor. Not all or nothing.", today: "Works in this prototype", ready: true },
  { icon: "clock", title: "Loss of capacity, not only death", body: "Someone with dementia or in a coma cannot object, so a timer fails. Seats can decide.", today: "Today: a mocked capacity document", ready: false },
  { icon: "key", title: "Any secret", body: "Letters, passwords, care wishes, or a wallet’s 12-word recovery phrase.", today: "Today: text items", ready: false },
];

const LIMITS = [
  "Nothing un-reads what an heir has already read.",
  "Two of three seats acting together could release early. Choose seats who do not answer to each other.",
  "Heirloom cannot force a bank or Apple to open an account. It passes on what Mai stored.",
];

export default function HelpPage() {
  return <AppShell eyebrow="Guide" title="How Heirloom works" description="A short guide for families and judges: who can do what, what Tide changes, and what to try first.">
    <div className={styles.page}>
      <nav className={styles.toc} aria-label="On this page">
        <p className={styles.tocLabel}>On this page</p>
        <ul>
          {SECTIONS.map(section => <li key={section.id}><Link href={`#${section.id}`}>{section.label}</Link></li>)}
        </ul>
      </nav>

      <section id="in-one-minute" className={styles.section} aria-labelledby="in-one-minute-title">
        <SectionHeader id="in-one-minute-title" eyebrow="The idea" title="In one minute" />
        <div className={styles.prose}>
          <p>Heirloom lets Mai seal what her family will need while she can still decide: care wishes for her daughter, bank logins for her son. Each item is encrypted in her browser, and Heirloom keeps only <Term id="ciphertext">ciphertext</Term>. Each item has one named <Term id="recipient">recipient</Term>.</p>
          <p>No one alone can hand an item over. Not Heirloom, not one admin, not one relative. A <Term id="release">release</Term> needs an independent <Term id="seat">seat</Term>, such as a notary, to approve it in the <Term id="enclave">Tide enclave</Term>. This prototype has one seat. Production needs two of three.</p>
          <p>Even after a release, the <Term id="tide-network">Tide network</Term> checks every open request: {TIDE_NETWORK.required} of {TIDE_NETWORK.total} independent nodes must agree that the person holds the right role. So Long can open his bank logins, while his sister&rsquo;s care wishes stay sealed.</p>
        </div>
      </section>

      <section id="who-can" className={styles.section} aria-labelledby="who-can-title">
        <SectionHeader id="who-can-title" eyebrow="Roles" title="Who can do what" description="Read means open an item in the browser. Release means let its recipient open it." />
        <div className={`table-scroll ${styles.tableWrap}`}>
          <table className={styles.whoTable}>
            <caption className="sr-only">Who can read and who can release Mai&rsquo;s items</caption>
            <thead>
              <tr><th scope="col">Who</th><th scope="col">Can read an item?</th><th scope="col">Can release an item?</th></tr>
            </thead>
            <tbody>
              {WHO.map(row => <tr key={row.username}>
                <th scope="row"><Person name={row.username} role={row.role} size="sm" /></th>
                {[row.read, row.release].map((answer, i) => <td key={i}>
                  <span className={`${styles.answer} ${styles[answer.kind]}`}>
                    <Icon name={ANSWER_ICON[answer.kind]} size={16} strokeWidth={2.5} />
                    <strong>{answer.word}</strong>
                  </span>
                  <span className={styles.answerDetail}>{answer.detail}</span>
                </td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="help">In production a release needs two of three independent seats. This prototype has one seat, Notary Duc.</p>
      </section>

      <div id="compare" className={styles.section}>
        <CompareCard title="An ordinary app vs Heirloom on Tide" description="An ordinary app asks you to trust its company and its admins. Heirloom on Tide removes that power, including from Heirloom itself." rows={COMPARE} />
      </div>

      <section id="next" className={styles.section} aria-labelledby="next-title">
        <SectionHeader id="next-title" eyebrow="Where this goes" title="What comes next" description="The prototype proves the core. These five properties are the product." />
        <ol className={styles.future}>
          {NEXT.map(item => <li className={styles.futureItem} key={item.title}>
            <span className={styles.futureIcon}><Icon name={item.icon} size={22} /></span>
            <div className={styles.futureText}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <span className={`${styles.today} ${item.ready ? styles.todayReady : styles.todayPartial}`}>
                <Icon name={item.ready ? "check" : "clock"} size={14} strokeWidth={2.5} />{item.today}
              </span>
            </div>
          </li>)}
        </ol>
        <div className={styles.callouts}>
          <Callout tone="info" title="Why one seat today">
            <p className={styles.calloutText}>The free Tide licence allowed three linked accounts: Mai, Long and Notary Duc. So this prototype runs with one seat. The design is two of three independent seats, and Heirloom is never one.</p>
          </Callout>
          <Callout tone="warning" title="Limits we are honest about">
            <ul className={styles.limits}>{LIMITS.map(limit => <li key={limit}>{limit}</li>)}</ul>
          </Callout>
        </div>
      </section>

      <section id="judges" className={styles.section} aria-labelledby="judges-title">
        <SectionHeader id="judges-title" eyebrow="Start here" title="For judges: what to try first" description="Three tries, about five minutes. Each uses a demo account." />
        <ol className={styles.judges}>
          <li>
            <span className={styles.judgeNum} aria-hidden="true">1</span>
            <div><p className={styles.judgeTitle}>See the refusal</p><p>Sign in as <code>long</code>, go to <strong>Server dump</strong> and press <strong>Try to open</strong>. The Tide network refuses: 0 of 14 nodes release a key.</p></div>
          </li>
          <li>
            <span className={styles.judgeNum} aria-hidden="true">2</span>
            <div><p className={styles.judgeTitle}>Try to skip the seat</p><p>Still as long, press <strong>Try to release to Long</strong>. TideCloak answers 403: not a seat. Heirloom&rsquo;s own server cannot do it either.</p></div>
          </li>
          <li>
            <span className={styles.judgeNum} aria-hidden="true">3</span>
            <div><p className={styles.judgeTitle}>Release it the right way</p><p>Sign in as <code>notary-duc</code>, go to <strong>Independent seats</strong>, release the bank logins and approve in the Tide enclave. Then sign in as long again: the bank logins open, the care wishes stay refused.</p></div>
          </li>
        </ol>
        <div className={styles.judgeFoot}>
          <p className="help">Prefer to watch? The 2-minute video <code>heirloom.mp4</code> in the repository shows the same run against TideCloak and the live Tide network. All people and data are fictional.</p>
          <div className="actions"><Link className="button" href="/">Start on the home page<Icon name="arrowRight" size={18} /></Link></div>
        </div>
      </section>

      <section id="glossary" className={styles.section} aria-labelledby="glossary-title">
        <SectionHeader id="glossary-title" eyebrow="Plain words" title="Glossary" description="The same short definitions you see when you press a dotted word." />
        <dl className={styles.glossary}>
          {Object.entries(GLOSSARY).map(([key, entry]) => <div className={styles.glossaryItem} key={key} id={`glossary-${key}`}>
            <dt>{entry.term}</dt>
            <dd>{entry.short}</dd>
          </div>)}
        </dl>
      </section>
    </div>
  </AppShell>;
}
