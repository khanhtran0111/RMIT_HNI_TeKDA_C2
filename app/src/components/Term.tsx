"use client";

// A jargon word that explains itself (a "toggletip"): an inline button with a dotted underline.
// Click, tap, Enter or Space shows a short plain-language definition from lib/glossary.ts;
// Escape, a second click, a click elsewhere or moving focus away closes it.
// The definition is announced through a polite live region the button controls.
// The popover is position: fixed and clamped to the viewport, so tables, clipped panels
// and 390px screens never cut it off or cause horizontal scroll.
// Do not put a Term inside another button, a link or a <label> (nested interactive content).
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getTerm, type GlossaryId } from "@/lib/glossary";
import styles from "./Term.module.css";

const EDGE = 16; // keep the popover this far from the viewport edges
const GAP = 8; // space between the word and the popover

export function Term({ id, children, explain }: {
  /** Key in GLOSSARY (lib/glossary.ts). */
  id: GlossaryId;
  /** The word as it reads in the sentence. Defaults to the glossary term. */
  children?: ReactNode;
  /** Override the glossary definition for this one use (keep it under 30 words). */
  explain?: string;
}) {
  const entry = getTerm(id);
  const popId = `term-${useId()}`;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  const close = useCallback(() => { setOpen(false); setPos(null); }, []);

  const place = useCallback(() => {
    const trigger = triggerRef.current, bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const r = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const w = bubble.offsetWidth, h = bubble.offsetHeight;
    const left = Math.max(EDGE, Math.min(r.left, vw - EDGE - w));
    const below = r.bottom + GAP;
    const top = below + h > vh - EDGE && r.top - GAP - h >= EDGE ? r.top - GAP - h : below;
    setPos({ top, left });
  }, []);

  // Measure before paint so the popover never flashes in the wrong place.
  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); triggerRef.current?.focus(); } };
    // Safari does not focus a clicked button, so blur alone cannot catch a click elsewhere.
    const onPointer = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) close(); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place, close]);

  return (
    <span ref={rootRef} className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={popId}
        aria-description="Shows a plain-language definition"
        onClick={() => (open ? close() : setOpen(true))}
        onBlur={close}
      >
        {children ?? entry.term}
      </button>
      <span id={popId} role="status" className={styles.live}>
        {open && (
          <span
            ref={bubbleRef}
            className={styles.bubble}
            style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden" }}
            // Clicking inside the definition must not blur the button and close it.
            onMouseDown={e => e.preventDefault()}
          >
            <span className={styles.bubbleTerm}>{entry.term}</span>{" "}
            <span className={styles.bubbleText}>{explain ?? entry.short}</span>
          </span>
        )}
      </span>
    </span>
  );
}
