// Small presentational primitives. No hooks, no next/* imports: usable anywhere, including server render.
// Buttons are plain elements with classes: <button> (primary), .button-secondary, .button-quiet, .button-danger;
// on a Link use className="button" plus the variant.
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Box = "div" | "section" | "aside" | "li";

export function Card({ children, as: Tag = "div", tone = "default", className, labelledBy, label }: {
  children: ReactNode;
  as?: Box;
  tone?: "default" | "sunk" | "tide" | "flat";
  className?: string;
  /** id of the heading that names this card (for section/aside). */
  labelledBy?: string;
  label?: string;
}) {
  const toneClass = tone === "default" ? "" : ` card-${tone}`;
  return <Tag className={`card${toneClass}${className ? ` ${className}` : ""}`} aria-labelledby={labelledBy} aria-label={label}>{children}</Tag>;
}

export function SectionHeader({ title, eyebrow, description, action, level = 2, id }: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** One action aligned right (a button or link). */
  action?: ReactNode;
  level?: 2 | 3;
  id?: string;
}) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <div className="section-header">
      <div className="section-header-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <Heading id={id}>{title}</Heading>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action && <div className="actions">{action}</div>}
    </div>
  );
}

const calloutIcon: Record<CalloutTone, IconName> = { info: "info", tide: "network", warning: "alert", success: "check", danger: "shieldX" };
type CalloutTone = "info" | "tide" | "warning" | "success" | "danger";

export function Callout({ tone = "info", title, children, icon, role, live }: {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
  /** "alert" for errors that need attention, "status" for async results. */
  role?: "alert" | "status" | "note";
  live?: boolean;
}) {
  return (
    <div className={`callout callout-${tone}`} role={role} aria-live={live ? "polite" : undefined}>
      <span className="callout-icon"><Icon name={icon ?? calloutIcon[tone]} size={20} /></span>
      <div className="callout-body">
        {title && <p className="callout-title">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/** Ciphertext as the server stores it: mono, clamped to 3 lines with a fade unless `full`. */
export function CipherBlock({ text, label = "Ciphertext stored by Heirloom", caption, full = false, heading }: {
  text: string;
  label?: ReactNode;
  caption?: ReactNode;
  full?: boolean;
  /** Render the label as an h3 with this exact text instead of the small label. */
  heading?: string;
}) {
  return (
    <figure className={`cipher-block ${full ? "cipher-full" : "cipher-clamp"}`}>
      {heading ? <h3 className="with-icon"><Icon name="lock" size={18} />{heading}</h3> : <span className="cipher-label"><Icon name="lock" size={14} />{label}</span>}
      <code className="cipher-text">{text}</code>
      {caption && <figcaption className="cipher-caption">{caption}</figcaption>}
    </figure>
  );
}

/** Opened content (plaintext) with the "Opened in your browser" heading. */
export function PlainPanel({ children, title = "Opened in your browser", note, level = 3 }: {
  children: ReactNode;
  title?: string;
  note?: ReactNode;
  level?: 3 | 4;
}) {
  const Heading = level === 4 ? "h4" : "h3";
  return (
    <div className="plain-panel" role="status">
      <Heading className="with-icon"><Icon name="unlock" size={20} />{title}</Heading>
      {typeof children === "string" ? <pre>{children}</pre> : children}
      {note && <p className="plain-note">{note}</p>}
    </div>
  );
}

export type StepState = "done" | "current" | "upcoming";
export type Step = { label: ReactNode; detail?: ReactNode; state?: StepState };
const stepWord: Record<StepState, string> = { done: "Done", current: "Now", upcoming: "Next" };

/** Request progress, e.g. Requested -> Approved -> Released. Pass `state` per step, or `current` (index). */
export function Stepper({ steps, current, label = "Progress" }: { steps: Step[]; current?: number; label?: string }) {
  return (
    <ol className="stepper" aria-label={label}>
      {steps.map((step, i) => {
        const state: StepState = step.state ?? (current === undefined ? "upcoming" : i < current ? "done" : i === current ? "current" : "upcoming");
        return (
          <li key={i} className={`step step-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="step-marker" aria-hidden="true">{state === "done" ? <Icon name="check" size={16} strokeWidth={3} /> : i + 1}</span>
            <span className="step-text">
              <span className="step-state">{stepWord[state]}</span>
              <span className="step-label">{step.label}</span>
              {step.detail && <span className="step-detail">{step.detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "Your next step": one sentence and exactly one action. */
export function NextStep({ title, children, action, eyebrow = "Your next step", icon = "arrowRight" }: {
  title: ReactNode;
  children?: ReactNode;
  /** The single action: <Link className="button" href=...> or <button>. */
  action?: ReactNode;
  eyebrow?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="next-step" role="note">
      <span className="next-step-icon"><Icon name={icon} size={20} /></span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <p className="next-step-title">{title}</p>
        {children && <div className="next-step-body">{children}</div>}
        {action && <div className="next-step-action">{action}</div>}
      </div>
    </div>
  );
}

const PEOPLE: Record<string, { name: string; tone: string }> = {
  mai: { name: "Mai", tone: "mai" },
  long: { name: "Long", tone: "long" },
  linh: { name: "Linh", tone: "linh" },
  "notary-duc": { name: "Notary Duc", tone: "duc" },
  duc: { name: "Notary Duc", tone: "duc" },
};

/** "notary-duc" -> "Notary Duc", "long" -> "Long". */
export function displayName(username: string): string {
  const known = PEOPLE[username.toLowerCase()];
  if (known) return known.name;
  return username.split(/[-_\s]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ") || username;
}

function initials(name: string): string {
  const words = name.split(/[-_\s]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

/** Initial circle for a person. Accepts a username ("notary-duc") or a display name ("Notary Duc"). */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const key = name.toLowerCase().replace(/\s+/g, "-");
  const tone = PEOPLE[key]?.tone ?? (key.endsWith("duc") ? "duc" : "other");
  const label = PEOPLE[key]?.name ?? displayName(name);
  // Initials are drawn by CSS (data-initials) so they never leak into the text of a card or a name.
  return <span className={`avatar avatar-${size} avatar-${tone}`} aria-hidden="true" data-initials={initials(label)} />;
}

/** Avatar + name + optional role line ("Vault owner", "Recipient", "Approver"). */
export function Person({ name, role, size = "md" }: { name: string; role?: ReactNode; size?: "sm" | "md" | "lg" }) {
  return (
    <span className="person">
      <Avatar name={name} size={size} />
      <span className="person-text"><span className="person-name">{displayName(name)}</span>{role && <span className="person-role">{role}</span>}</span>
    </span>
  );
}

/** A jargon word with its plain-language explanation on hover and for screen readers. Use the first time a term appears. */
export function Term({ children, explain }: { children: ReactNode; explain: string }) {
  return <abbr className="term" title={explain}>{children}</abbr>;
}
