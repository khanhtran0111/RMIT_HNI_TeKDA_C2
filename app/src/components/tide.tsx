// Tide-visibility components: make what the Tide network does visible at the moment it matters.
// Pure presentation (no hooks, no next/* imports): safe in renderToStaticMarkup and on any page.
// Honesty rule: numbers come from the observed Tide error (classifyTideError(err).nodes) when present;
// otherwise the constant below is shown and always labelled "this network".
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

/** This demo realm uses Tide's production network: 14 of 20 independent nodes must agree. */
export const TIDE_NETWORK = { required: 14, total: 20, label: "this network" } as const;

export type NodeGridState = "idle" | "checking" | "refused" | "released";

export function NodeGrid({ state, required = TIDE_NETWORK.required, total = TIDE_NETWORK.total, got, compact = false, headline, sub }: {
  state: NodeGridState;
  /** Nodes that must agree (threshold). Default: this network's 14. */
  required?: number;
  /** Nodes in the network. Default: this network's 20. */
  total?: number;
  /** Nodes that released a key share, when observed. Refused: from the error. Released: defaults to `required`. */
  got?: number;
  compact?: boolean;
  /** Override the caption's first line (false hides it). */
  headline?: ReactNode;
  /** Override the caption's second line (false hides it). */
  sub?: ReactNode;
}) {
  const n = Math.max(1, Math.round(total));
  const need = Math.min(Math.max(1, Math.round(required)), n);
  const shares = state === "released" ? Math.min(got ?? need, n) : state === "refused" ? Math.min(Math.max(0, got ?? 0), n) : 0;
  const defaultHeadline = {
    idle: `${need} of ${n} independent nodes must agree to release a key`,
    checking: "Asking the Tide network…",
    refused: got === undefined ? "Below the threshold: no key was released" : `${got} of ${need} nodes released a share`,
    released: `Threshold met: ${need} of ${n} independent nodes`,
  }[state];
  const defaultSub = {
    idle: `On ${TIDE_NETWORK.label}, no single node, company or admin holds the whole key.`,
    checking: `Each node checks the item’s policy and your role. ${need} of ${n} must agree on ${TIDE_NETWORK.label}.`,
    refused: `On ${TIDE_NETWORK.label}, ${need} of ${n} independent nodes must agree before any key is released.`,
    released: `The nodes checked the item’s policy and your role before releasing their shares. On ${TIDE_NETWORK.label}, ${need} of ${n} must agree.`,
  }[state];
  return (
    <figure className={`nodegrid nodegrid-${state}${compact ? " nodegrid-compact" : ""}`} data-state={state}>
      <div className="nodegrid-dots" aria-hidden="true" style={{ "--n": n } as CSSProperties}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={`node-dot${i < shares ? " is-share" : ""}`} style={{ "--i": i } as CSSProperties} />
        ))}
        <span className="nodegrid-bracket" style={{ gridColumn: `1 / ${need + 1}` }}><span>{need} needed</span></span>
      </div>
      <figcaption className="nodegrid-caption">
        {headline !== false && <span className="nodegrid-headline">{headline === undefined ? defaultHeadline : headline}</span>}
        {sub !== false && <span className="nodegrid-sub">{sub === undefined ? defaultSub : sub}</span>}
      </figcaption>
    </figure>
  );
}

export type TideTone = "neutral" | "sealed" | "refused" | "released";

/** "What Tide just did": 1-3 plain sentences shown right after a Tide action. */
export function TideProof({ title = "What Tide just did", lines, tone = "neutral", children, live = false }: {
  title?: string;
  lines: ReactNode[];
  tone?: TideTone;
  /** Optional extra visual, e.g. a compact <NodeGrid />. */
  children?: ReactNode;
  /** Announce politely to screen readers when it appears after an async action. */
  live?: boolean;
}) {
  return (
    <aside className={`tide-proof tide-proof-${tone}`} aria-label={title} {...(live ? { "aria-live": "polite" as const } : {})}>
      <div className="tide-proof-head">
        <span className="tide-proof-icon"><Icon name="network" size={18} /></span>
        <p className="tide-proof-title">{title}</p>
      </div>
      <ul className="tide-proof-lines">{lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
      {children && <div className="tide-proof-extra">{children}</div>}
    </aside>
  );
}

export type CompareRow = { label: ReactNode; ordinary: ReactNode; tide: ReactNode };

/** "An ordinary app" vs "Heirloom on Tide", row by row. Stacks on phones. */
export function CompareCard({ rows, title, description, ordinaryLabel = "An ordinary app", tideLabel = "Heirloom on Tide", headingLevel = 2 }: {
  rows: CompareRow[];
  title?: ReactNode;
  description?: ReactNode;
  ordinaryLabel?: string;
  tideLabel?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section className="compare" aria-label={typeof title === "string" ? title : `${ordinaryLabel} compared with ${tideLabel}`}>
      {(title || description) && <div className="compare-title">{title && <Heading>{title}</Heading>}{description && <p>{description}</p>}</div>}
      <div className="compare-head" aria-hidden="true"><div /><div>{ordinaryLabel}</div><div className="compare-tide-head">{tideLabel}</div></div>
      {rows.map((row, i) => (
        <div className="compare-row" key={i}>
          <div className="compare-label">{row.label}</div>
          <div className="compare-cell compare-ordinary"><Icon name="x" size={18} /><div><span className="compare-cell-label">{ordinaryLabel}</span>{row.ordinary}</div></div>
          <div className="compare-cell compare-tide"><Icon name="check" size={18} /><div><span className="compare-cell-label">{tideLabel}</span>{row.tide}</div></div>
        </div>
      ))}
    </section>
  );
}
