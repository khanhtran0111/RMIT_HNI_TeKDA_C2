// Public walkthrough double for the Tide relationship-policy helpers. No cryptography and no Tide network:
// it applies the same rules the RelationshipAttestation:1 policies enforce in the real app (an owner
// policy opens for vault-owner-mai; a heir policy opens only for the holder of that record's heir role)
// and answers with the same error shape the real network returns.
import { demoFixtures, heirRoleForRecord } from "../src/lib/fixtures";
import type { RecordId } from "../src/lib/store";
import { useSession } from "./session";
const OWNER_ROLE = "vault-owner-mai";

function refusal(role: string) {
  return new Error("TIDE-TIDEJS-NET-THRESHOLD_FAILURE: Could not reach enough VVK ORKs (got 0 of 14 required, 20 of 20 failed) [simulated]", { cause: `'${role}' role not found in doken.` });
}
function requiredRole(recordId: string, policy: string) {
  return policy.startsWith("owner") ? OWNER_ROLE : heirRoleForRecord[recordId as RecordId] ?? "heir-bank-mai";
}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
function fakeCiphertext() {
  const bytes = new Uint8Array(330); crypto.getRandomValues(bytes);
  let s = ""; bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s);
}

export async function encryptForRecord(_data: string, recordId: string, policy: string) {
  const { roles } = useSession();
  await wait(900);
  if (!roles.includes(requiredRole(recordId, policy))) throw refusal(requiredRole(recordId, policy));
  return fakeCiphertext();
}
export async function decryptForRecord(_ciphertext: string, recordId: string, policy: string) {
  const { roles } = useSession();
  const role = requiredRole(recordId, policy);
  await wait(1600);
  if (!roles.includes(role)) throw refusal(role);
  return demoFixtures.find(item => item.recordId === recordId)?.content ?? "";
}
export async function signRelationshipPolicy(input: { vendorId: string; subject: { type: string; id: string }; recordId: string; access: string }, _adminPolicy: Uint8Array) {
  return `${input.access === "read" ? "heir" : "owner"}:${input.recordId}`;
}
export function describeRelationshipPolicy(policy: string) {
  return { contractId: "RelationshipAttestation:1", subjectType: "Role", subjectId: policy.startsWith("owner") ? OWNER_ROLE : policy.includes("care") ? "heir-care-mai" : "heir-bank-mai", clientId: "", recordId: policy.includes("care") ? "mai-care" : "mai-bank", roles: "[\"_tide_decryptor\"]", signed: true, isRelationshipPolicy: true };
}
