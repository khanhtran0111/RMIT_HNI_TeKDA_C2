import { Icon, type IconName } from "./Icon";

// Every state = icon + uppercase word in a pill. Colour is never the only signal.
const icons = { sealed: "lock", pending: "clock", released: "unlock", refused: "shieldX" } satisfies Record<string, IconName>;
export type ChipState = keyof typeof icons;

export function StatusChip({ state, label }: { state: ChipState; label?: string }) {
  return <span className={`status-chip status-${state}`}><Icon name={icons[state]} size={14} strokeWidth={2.5} />{label ?? state.toUpperCase()}</span>;
}
