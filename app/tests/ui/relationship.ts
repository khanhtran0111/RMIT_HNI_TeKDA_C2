// Only the isolated UI harness imports this double. It provides no cryptography.
// Rules mirror the RelationshipAttestation:1 policies (SPEC section 3): an owner policy opens for
// vault-owner-mai, a heir policy opens only for the holder of that record's heir role.
import { demoFixtures, heirRoleForRecord } from "../../src/lib/fixtures";
import type { RecordId } from "../../src/lib/store";
import { useSession } from "./session";
const plaintext = new Map<string, string>();
const OWNER_ROLE = "vault-owner-mai";

function refusal(role: string) {
  return new Error("TIDE-TIDEJS-NET-THRESHOLD_FAILURE: Could not reach enough VVK ORKs (got 0 of 14 required)", { cause: `'${role}' role not found in doken.` });
}
function requiredRole(recordId: string, policy: string) {
  return policy.startsWith("owner") ? OWNER_ROLE : heirRoleForRecord[recordId as RecordId] ?? "heir-bank-mai";
}

export async function encryptForRecord(data: string, recordId: string, policy: string) {
  const { roles } = useSession();
  if (!roles.includes(requiredRole(recordId, policy))) throw refusal(requiredRole(recordId, policy));
  plaintext.set(recordId, data);
  return `TEST-ONLY-CIPHERTEXT-${recordId}-${crypto.randomUUID()}`;
}
export async function decryptForRecord(_ciphertext: string, recordId: string, policy: string) {
  const { roles } = useSession();
  const role = requiredRole(recordId, policy);
  if (!roles.includes(role)) throw refusal(role);
  return plaintext.get(recordId) ?? demoFixtures.find(item => item.recordId === recordId)?.content ?? "";
}
export async function signRelationshipPolicy(input: { vendorId: string; subject: { type: string; id: string }; recordId: string; access: string }, _adminPolicy: Uint8Array) {
  return `${input.access === "read" ? "heir" : "owner"}:${input.recordId}`;
}
export function describeRelationshipPolicy(policy: string) {
  return { contractId: "RelationshipAttestation:1", subjectType: "Role", subjectId: policy.startsWith("owner") ? OWNER_ROLE : policy.includes("care") ? "heir-care-mai" : "heir-bank-mai", clientId: "", recordId: policy.includes("care") ? "mai-care" : "mai-bank", roles: "[\"_tide_decryptor\"]", signed: true, isRelationshipPolicy: true };
}
