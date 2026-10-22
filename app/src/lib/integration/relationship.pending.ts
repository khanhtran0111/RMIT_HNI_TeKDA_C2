// Exact call signatures of the pack helper; never substitute self-encryption or fake ciphertext.
function missing(): never { throw new Error("Relationship policies are not connected yet. Dev A must supply src/lib/tide/relationship.ts and sign the four policies on /setup."); }
export async function encryptForRecord(_data: string, _recordId: string, _policy: string): Promise<string> { return missing(); }
export async function decryptForRecord(_encrypted: string, _recordId: string, _policy: string): Promise<string> { return missing(); }
export function describeRelationshipPolicy(_policy: string): { contractId: string; subjectType: string; subjectId: string; clientId: string; recordId: string; roles: string; signed: boolean; isRelationshipPolicy: boolean } { return missing(); }
