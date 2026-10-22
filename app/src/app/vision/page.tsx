// /vision: public page (no AccessGate). Heirloom as the first door of a platform of release rules.
// All copy and numbers come from ./data; layout and the hero treatment of AppShell's heading from ./vision.module.css.
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { CONTRAST, CTA, EXPLORER, HERO, META, NETWORK, NUMBERS, ROADMAP } from "./data";
import { DoorExplorer } from "./DoorExplorer";
import { NetworkMotif } from "./NetworkMotif";
import { VisionIcon } from "./VisionIcon";
import styles from "./vision.module.css";

export const metadata: Metadata = { title: META.title, description: META.description };

const HORIZON_TONE: Record<string, string> = { now: styles.hNow, next: styles.hNext, then: styles.hThen, vision: styles.hVision };

function Intro({ id, eyebrow, title, description }: { id: string; eyebrow: string; title: string; description: string }) {
  return (
    <div className={styles.intro}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <p className={styles.introText}>{description}</p>
    </div>
  );
}

export default function VisionPage() {
  const lit = new Set(NETWORK.litOrder.slice(0, NETWORK.required));
  return (
    <div className={styles.root}>
      <AppShell eyebrow={HERO.eyebrow} title={HERO.title} description={HERO.subline}>
        <div className={`${styles.heroFoot} ${styles.dark}`}>
          <p className={styles.heroLead}>{HERO.lead}</p>
          <div className={styles.heroActions}>
            <a className={`button button-lg ${styles.btnLight}`} href={HERO.primary.href}>{HERO.primary.label}<Icon name="arrowRight" size={18} /></a>
            <Link className={`button button-lg ${styles.btnGhost}`} href={HERO.secondary.href}>{HERO.secondary.label}</Link>
          </div>
          <ul className={styles.pillars} aria-label={HERO.pillarsLabel}>
            {HERO.pillars.map(p => <li key={p}><Icon name="check" size={16} strokeWidth={3} />{p}</li>)}
          </ul>
        </div>

        <div className={`${styles.heroArt} ${styles.dark}`}><NetworkMotif /></div>

        <div className={styles.body}>
          <section className={styles.band} aria-labelledby="vision-numbers">
            <Intro id="vision-numbers" eyebrow={NUMBERS.eyebrow} title={NUMBERS.title} description={NUMBERS.description} />
            <ul className={styles.figures}>
              {NUMBERS.items.map(f => (
                <li key={f.source} className={styles.figure}>
                  <p className={styles.big}>{f.big}{f.unit && <span className={styles.unit}>{f.unit}</span>}</p>
                  <p className={styles.figLabel}>{f.label}</p>
                  <p className={styles.figMeaning}>{f.meaning}</p>
                  <p className={styles.figSource}>{NUMBERS.sourcePrefix} <a href={f.url} target="_blank" rel="noopener noreferrer">{f.source}<span className="sr-only"> {NUMBERS.newTab}</span></a></p>
                </li>
              ))}
            </ul>
          </section>

          <section id={EXPLORER.id} className={styles.section} aria-labelledby="vision-doors">
            <Intro id="vision-doors" eyebrow={EXPLORER.eyebrow} title={EXPLORER.title} description={EXPLORER.description} />
            <DoorExplorer />
          </section>

          <section id={CONTRAST.id} className={styles.section} aria-labelledby="vision-why">
            <Intro id="vision-why" eyebrow={CONTRAST.eyebrow} title={CONTRAST.title} description={CONTRAST.description} />
            <div className={styles.contrast}>
              <div className={`${styles.col} ${styles.colOrdinary}`}>
                <div className={styles.colHead}><h3 className={styles.colLabel}>{CONTRAST.ordinary.label}</h3><p className={styles.colKicker}>{CONTRAST.ordinary.kicker}</p></div>
                {CONTRAST.rows.map(r => <div key={r.topic} className={styles.colRow}><p className={styles.rowTopic}>{r.topic}</p><p className={styles.rowText}><Icon name="x" size={18} strokeWidth={2.5} /><span>{r.ordinary}</span></p></div>)}
                <p className={styles.colFoot}>{CONTRAST.ordinary.foot}</p>
              </div>
              <div className={`${styles.col} ${styles.colTide} ${styles.dark}`}>
                <div className={styles.colHead}><h3 className={styles.colLabel}>{CONTRAST.tide.label}</h3><p className={styles.colKicker}>{CONTRAST.tide.kicker}</p></div>
                {CONTRAST.rows.map(r => <div key={r.topic} className={styles.colRow}><p className={styles.rowTopic}>{r.topic}</p><p className={styles.rowText}><Icon name="check" size={18} strokeWidth={2.5} /><span>{r.tide}</span></p></div>)}
                <p className={styles.colFoot}>{CONTRAST.tide.foot}</p>
              </div>
            </div>
            <aside className={styles.proof} aria-label={CONTRAST.proof.label}>
              <span className={styles.proofIcon}><Icon name="shieldX" size={22} /></span>
              <div>
                <p className={styles.proofLabel}>{CONTRAST.proof.label}</p>
                <ul className={styles.proofLines}>{CONTRAST.proof.lines.map(l => <li key={l}>{l}</li>)}</ul>
                <p className={styles.proofNote}>{CONTRAST.proof.note}</p>
              </div>
            </aside>
          </section>

          <section id={ROADMAP.id} className={styles.section} aria-labelledby="vision-roadmap">
            <Intro id="vision-roadmap" eyebrow={ROADMAP.eyebrow} title={ROADMAP.title} description={ROADMAP.description} />
            <ol className={styles.timeline}>
              {ROADMAP.horizons.map(h => (
                <li key={h.id} className={`${styles.horizon} ${HORIZON_TONE[h.id] ?? ""}`}>
                  <span className={styles.marker}><VisionIcon name={h.icon} size={20} /></span>
                  <div className={styles.hCard}>
                    <h3 className={styles.hHead}><span className={styles.hWhen}>{h.horizon}</span><span className={styles.hName}>{h.name}</span></h3>
                    {h.status && <span className={`status-chip status-released ${styles.hStatus}`}><Icon name="check" size={14} strokeWidth={3} />{h.status}</span>}
                    {h.points.length > 0 && <ul className={styles.hPoints}>{h.points.map(p => <li key={p}>{p}</li>)}</ul>}
                    {h.partners && <div className={styles.partnersWrap}><p className={styles.partnersLabel}>{ROADMAP.partnersLabel}</p><ul className={styles.partners}>{h.partners.map(p => <li key={p}>{p}</li>)}</ul></div>}
                    {h.statement && <p className={styles.hStatement}>{h.statement}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={`${styles.cta} ${styles.dark}`} aria-labelledby="vision-cta">
            <div className={styles.ctaText}>
              <p className={`eyebrow ${styles.ctaEyebrow}`}>{CTA.eyebrow}</p>
              <h2 id="vision-cta">{CTA.title}</h2>
              <p className={styles.ctaBody}>{CTA.body}</p>
              <div className={styles.heroActions}>
                <Link className={`button button-lg ${styles.btnLight}`} href={CTA.primary.href}>{CTA.primary.label}<Icon name="arrowRight" size={18} /></Link>
                <Link className={`button button-lg ${styles.btnGhost}`} href={CTA.secondary.href}>{CTA.secondary.label}</Link>
              </div>
            </div>
            <div className={styles.ctaDots} aria-hidden="true">
              {Array.from({ length: NETWORK.total }, (_, i) => <span key={i} className={lit.has(i) ? styles.ctaDotOn : styles.ctaDotOff} style={{ "--i": i } as CSSProperties} />)}
            </div>
            <p className={styles.ctaFoot}>{CTA.footnote}</p>
          </section>
        </div>
      </AppShell>
    </div>
  );
}
