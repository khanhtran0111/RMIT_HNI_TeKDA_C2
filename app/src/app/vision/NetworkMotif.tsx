// Hero motif: the network's 20 nodes on a ring; the 14 that must agree light up one after another, CSS only.
// Reduced motion shows the final state (14 lit, threshold met). The figcaption carries the meaning for screen readers.
import type { CSSProperties } from "react";
import { NETWORK } from "./data";
import styles from "./vision.module.css";

const C = 200;      // centre of the 400 x 400 viewBox
const RING = 166;   // node ring radius
const CORE = 76;    // threshold ring radius

function at(i: number, total: number, r: number) {
  const a = ((-90 + (360 / total) * i) * Math.PI) / 180;
  return { x: Number((C + r * Math.cos(a)).toFixed(2)), y: Number((C + r * Math.sin(a)).toFixed(2)) };
}

export function NetworkMotif() {
  const order = new Map(NETWORK.litOrder.slice(0, NETWORK.required).map((node, k) => [node, k] as const));
  const nodes = Array.from({ length: NETWORK.total }, (_, i) => ({ i, k: order.get(i), p: at(i, NETWORK.total, RING), a: at(i, NETWORK.total, CORE + 8), b: at(i, NETWORK.total, RING - 16) }));
  const lit = nodes.filter(n => n.k !== undefined);
  return (
    <figure className={styles.motif} style={{ "--req": NETWORK.required } as CSSProperties}>
      <div className={styles.motifStage}>
        <svg className={styles.motifSvg} viewBox="0 0 400 400" aria-hidden="true" focusable="false">
          <circle className={styles.orbit} cx={C} cy={C} r={RING + 22} />
          {nodes.map(n => <line key={`s${n.i}`} className={styles.spoke} x1={n.a.x} y1={n.a.y} x2={n.b.x} y2={n.b.y} />)}
          {lit.map(n => <line key={`l${n.i}`} className={styles.spokeLit} style={{ "--k": n.k } as CSSProperties} x1={n.a.x} y1={n.a.y} x2={n.b.x} y2={n.b.y} />)}
          <circle className={styles.core} cx={C} cy={C} r={CORE} />
          <circle className={styles.coreMet} cx={C} cy={C} r={CORE} />
          {nodes.map(n => <circle key={`n${n.i}`} className={n.k === undefined ? styles.nodeIdle : styles.nodeBase} cx={n.p.x} cy={n.p.y} r={9} />)}
          {lit.map(n => (
            <g key={`g${n.i}`} className={styles.nodeLit} style={{ "--k": n.k } as CSSProperties}>
              <circle className={styles.nodeHalo} cx={n.p.x} cy={n.p.y} r={18} />
              <circle className={styles.nodeCore} cx={n.p.x} cy={n.p.y} r={9} />
            </g>
          ))}
        </svg>
        <div className={styles.motifCenter} aria-hidden="true">
          <span className={styles.count} />
          <span className={styles.countLabel}>{NETWORK.countLabel}</span>
        </div>
      </div>
      <p className={styles.metLine} aria-hidden="true">{NETWORK.met}</p>
      <figcaption className={styles.motifCaption}>
        <span className={styles.motifHeadline}>{NETWORK.caption}</span>
        <span>{NETWORK.sub}</span>
        <span className={styles.legend} aria-hidden="true"><span className={styles.legendOn}>{NETWORK.legendOn}</span><span className={styles.legendOff}>{NETWORK.legendOff}</span></span>
      </figcaption>
    </figure>
  );
}
