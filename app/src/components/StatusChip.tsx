const icons = { sealed: "◇", pending: "◷", released: "✓", refused: "⊘" };
export function StatusChip({ state, label }: { state: keyof typeof icons; label?: string }) {
  return <span className={`status-chip status-${state}`}><span aria-hidden="true">{icons[state]}</span> {label ?? state.toUpperCase()}</span>;
}
