import fixtures from "../../../demo/fixtures/heirloom.json";
import type { RecordId, Recipient } from "./store";

export interface Fixture { recordId: RecordId; title: string; recipientUsername: Recipient; content: string }
export const demoFixtures = fixtures as Fixture[];
export { recordForRecipient, heirRoleForRecord } from "./records";
