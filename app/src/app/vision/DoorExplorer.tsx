"use client";

// "One engine, many doors": pick a door, read its release rule. Toggle buttons (aria-pressed) drive one rule card;
// a polite live line announces the change without re-reading the whole card.
import { useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/Icon";
import { DOORS, EXPLORER } from "./data";
import { VisionIcon } from "./VisionIcon";
import styles from "./vision.module.css";

const STEP_TONE = [styles.stepSeal, styles.stepName, styles.stepApprove, styles.stepOpen];

export function DoorExplorer() {
  const [active, setActive] = useState(DOORS[0].id);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, DOORS.findIndex(d => d.id === active));
  const door = DOORS[index];

  function choose(i: number, focus = false) {
    const next = (i + DOORS.length) % DOORS.length;
    setActive(DOORS[next].id);
    if (focus) buttons.current[next]?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const moves: Record<string, number> = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: DOORS.length - 1 };
    if (e.key in moves) { e.preventDefault(); choose(moves[e.key], true); }
  }

  return (
    <div className={styles.explorer}>
      <div className={styles.doorList} role="group" aria-label={EXPLORER.pickLabel}>
        {DOORS.map((d, i) => (
          <button
            key={d.id}
            ref={el => { buttons.current[i] = el; }}
            type="button"
            className={styles.doorBtn}
            aria-pressed={d.id === active}
            aria-controls="vision-door-rule"
            onClick={() => choose(i)}
            onKeyDown={e => onKey(e, i)}
          >
            <span className={styles.doorNum} aria-hidden="true">{d.n}</span>
            <span className={styles.doorGlyph}><VisionIcon name={d.icon} size={20} /></span>
            <span className={styles.doorText}>
              <span className={styles.doorTitle}>{d.title}{d.live && <span className={styles.doorLive}>{EXPLORER.liveTag}</span>}</span>
              <span className={styles.doorShort}>{d.short}</span>
            </span>
            <span className={styles.doorChevron} aria-hidden="true"><Icon name="chevronRight" size={18} /></span>
          </button>
        ))}
      </div>

      <article id="vision-door-rule" className={styles.rule} aria-labelledby="vision-door-title">
        <p className="sr-only" role="status" aria-live="polite">{`${EXPLORER.showing} ${EXPLORER.doorWord.toLowerCase()} ${door.n}: ${door.title}`}</p>
        <div key={door.id} className={styles.ruleInner}>
          <header className={styles.ruleHead}>
            <span className={styles.ruleGlyph}><VisionIcon name={door.icon} size={28} /></span>
            <div className={styles.ruleHeadText}>
              <p className={styles.ruleKicker}>{EXPLORER.cardLabel} · {EXPLORER.doorWord} {door.n}</p>
              <h3 id="vision-door-title" className={styles.ruleTitle}>{door.title}</h3>
            </div>
            {door.live
              ? <span className="status-chip status-released"><Icon name="check" size={14} strokeWidth={3} />{EXPLORER.live}</span>
              : <span className={styles.designChip}><Icon name="clock" size={14} />{EXPLORER.design}</span>}
          </header>
          <p className={styles.ruleTagline}>{door.tagline}</p>

          <dl className={styles.fields}>
            <div className={`${styles.field} ${styles.fieldSealed}`}>
              <dt><Icon name="lock" size={16} />{EXPLORER.sealedBy}</dt>
              <dd><strong>{door.sealedBy}</strong><span className={styles.fieldSub}>{door.sealed}</span></dd>
            </div>
            <div className={`${styles.field} ${styles.fieldOpen}`}>
              <dt><Icon name="unlock" size={16} />{EXPLORER.opensFor}</dt>
              <dd><strong>{door.opensFor}</strong><span className={styles.fieldSub}>{door.when}</span></dd>
            </div>
            <div className={`${styles.field} ${styles.fieldDecide} ${styles.wide}`}>
              <dt><Icon name="scale" size={16} />{EXPLORER.decidedBy}</dt>
              <dd>
                <span className={styles.quorum}><span className={styles.quorumDots} aria-hidden="true"><i /><i /><i /></span>{EXPLORER.seatsRule}</span>
                <ul className={styles.seats}>
                  {door.seats.map(seat => <li key={seat} className={styles.seat}><span className={styles.seatIcon}><Icon name="user" size={14} /></span>{seat}</li>)}
                </ul>
                {door.liveNote && <span className={styles.liveNote}><Icon name="info" size={16} />{door.liveNote}</span>}
              </dd>
            </div>
            <div className={`${styles.field} ${styles.fieldNever} ${styles.wide}`}>
              <dt><Icon name="shieldX" size={16} />{EXPLORER.never}</dt>
              <dd>
                <ul className={styles.nevers}>
                  {[EXPLORER.company, ...door.never].map(who => <li key={who} className={styles.never}><Icon name="x" size={14} strokeWidth={2.5} /><span>{who}</span></li>)}
                </ul>
                <span className={styles.neverNote}>{EXPLORER.companyNote}</span>
              </dd>
            </div>
          </dl>

          <div className={styles.engine}>
            <p className={styles.engineTitle}><Icon name="network" size={16} />{EXPLORER.engineTitle}</p>
            <ol className={styles.engineSteps}>
              {EXPLORER.engineSteps.map((label, i) => (
                <li key={label} className={`${styles.engineStep} ${STEP_TONE[i]}`}>
                  <span className={styles.engineNum} aria-hidden="true">{i + 1}</span>
                  <span className={styles.engineText}><strong>{label}</strong><span>{door.engine[i]}</span></span>
                  {i < EXPLORER.engineSteps.length - 1 && <span className={styles.engineArrow} aria-hidden="true"><Icon name="arrowRight" size={14} strokeWidth={2.5} /></span>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </article>
    </div>
  );
}
