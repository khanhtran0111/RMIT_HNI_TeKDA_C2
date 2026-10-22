// "Who can open this?": one plain sentence plus a 3-step mini progress (Sealed -> Released -> Opened).
// The progress always tracks the recipient's path, not the owner's own reads.
// Presentational only: the caller maps its own state to `state`.
import { useId, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Term } from "./Term";
import styles from "./AccessSummary.module.css";

export type AccessState = "sealed" | "pending" | "released" | "opened" | "refused";

type StepStatus = "done" | "current" | "upcoming";
const LABELS = ["Sealed", "Released", "Opened"] as const;
/** Index of the current step per state. "refused" keeps the item at Sealed; "pending" = a release waits for a seat. */
const CURRENT: Record<AccessState, number> = { sealed: 0, refused: 0, pending: 1, released: 1, opened: 2 };
const CURRENT_ICON: Record<AccessState, IconName> = { sealed: "lock", refused: "shieldX", pending: "clock", released: "unlock", opened: "check" };
/** A short visible word under the current step, only where the label alone would mislead. */
const CURRENT_NOTE: Partial<Record<AccessState, string>> = { refused: "Refused", pending: "Waiting" };

const seat = <Term id="seat">seat</Term>;

function sentence(state: AccessState, name: string, isOwnerView: boolean, isRecipientView: boolean, ownerName?: string): ReactNode {
  const heirloom = (still: boolean) => <strong>{still ? "Heirloom still cannot read it." : "Heirloom cannot open it."}</strong>;
  const who = isRecipientView ? "you" : name;
  // The owner can always open her own item; say so when we know her name.
  const onlyWho = isOwnerView ? <>Only you and {name} can open this; {name} only</> : ownerName ? <>Besides {ownerName}, only {who} can open this,</> : <>Only {who} can open this,</>;
  switch (state) {
    case "pending":
      return <>A release to {who} is waiting for a {seat} to approve it. {heirloom(false)}</>;
    case "released":
      return <>A {seat} approved the release, so {who} can open this now. {heirloom(true)}</>;
    case "opened":
      return isRecipientView
        ? <>You opened this in your browser, after a {seat} approved the release. {heirloom(true)}</>
        : <>{name} opened this after a {seat} approved the release. {heirloom(true)}</>;
    case "refused":
      if (isRecipientView) return <>The Tide network refused to open this for you. It opens only after a {seat} approves its release. {heirloom(false)}</>;
      return <>The Tide network refused. {onlyWho} after a {seat} approves the release. {heirloom(false)}</>;
    default:
      return <>{onlyWho} after a {seat} approves the release. {heirloom(false)}</>;
  }
}

export function AccessSummary({ recipientName, state, isOwnerView = false, isRecipientView = false, ownerName }: {
  /** Display name of the item's recipient, e.g. "Long". */
  recipientName: string;
  state: AccessState;
  /** The owner is looking: "Only you and Long can open this; Long only after a seat approves the release." */
  isOwnerView?: boolean;
  /** The recipient is looking: says "you" instead of the recipient's name. */
  isRecipientView?: boolean;
  /** Display name of the owner, e.g. "Mai": adds "Besides Mai, ..." for non-owner viewers. */
  ownerName?: string;
}) {
  const headId = useId();
  const current = CURRENT[state];
  return (
    <div className={`${styles.box} ${styles[state]}`} role="group" aria-labelledby={headId}>
      <p className={styles.head} id={headId}><Icon name="key" size={16} />Who can open this?</p>
      <p className={styles.sentence}>{sentence(state, recipientName, isOwnerView, isRecipientView, ownerName)}</p>
      <ol className={styles.steps} aria-label="Progress">
        {LABELS.map((label, i) => {
          const status: StepStatus = i < current ? "done" : i === current ? "current" : "upcoming";
          const note = status === "current" ? CURRENT_NOTE[state] : undefined;
          return (
            <li key={label} className={`${styles.step} ${styles[status]}`} aria-current={status === "current" ? "step" : undefined}>
              <span className={styles.marker} aria-hidden="true">
                {status === "done" ? <Icon name="check" size={14} strokeWidth={3} /> : status === "current" ? <Icon name={CURRENT_ICON[state]} size={14} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={styles.label}>{label}{status === "done" && <span className="sr-only"> (done)</span>}</span>
              {note && <span className={styles.note}>{note}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
