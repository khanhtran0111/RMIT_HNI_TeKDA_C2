// Record and role names only. Kept apart from fixtures.ts, which imports the demo fixture JSON
// (item plaintext), so pages that need these maps do not ship that text in their client bundle.
import type { RecordId, Recipient } from "./store";

export const recordForRecipient: Record<Recipient, RecordId> = { linh: "mai-care", long: "mai-bank" };
export const heirRoleForRecord: Record<RecordId, string> = { "mai-care": "heir-care-mai", "mai-bank": "heir-bank-mai" };
