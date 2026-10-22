// Only the isolated UI harness imports this double. It provides no cryptography.
import { demoFixtures } from "../../src/lib/fixtures";
import { useSession } from "./session";
const plaintext = new Map<string, string>();
export async function encryptForRecord(data: string, recordId: string, _policy: string) {
  plaintext.set(recordId, data);
  return `TEST-ONLY-CIPHERTEXT-${recordId}-${crypto.randomUUID()}`;
}
export async function decryptForRecord(_ciphertext: string, recordId: string, _policy: string) {
  const { username, roles } = useSession();
  if (username === "mai" || (recordId === "mai-bank" && roles.includes("heir-bank-mai"))) return plaintext.get(recordId) ?? demoFixtures.find(item => item.recordId === recordId)!.content;
  const role = recordId === "mai-care" ? "heir-care-mai" : "heir-bank-mai";
  throw new Error("TIDE-TIDEJS-NET-THRESHOLD_FAILURE: Could not reach enough VVK ORKs (got 0 of 14 required)", { cause: `'${role}' role not found in doken.` });
}
export function describeRelationshipPolicy(policy: string) {
  return { contractId: "RelationshipAttestation:1", subjectType: "Role", subjectId: policy.startsWith("owner") ? "vault-owner-mai" : policy.includes("care") ? "heir-care-mai" : "heir-bank-mai", clientId: "", recordId: policy.includes("care") ? "mai-care" : "mai-bank", roles: "[\"_tide_decryptor\"]", signed: true, isRelationshipPolicy: true };
}
