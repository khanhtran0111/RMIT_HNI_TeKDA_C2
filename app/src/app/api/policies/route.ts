import { NextRequest } from "next/server";
import { withAuth, withClientRole } from "@/lib/auth/middleware";
import { readPolicies, writePolicy, type PolicyEntry } from "@/lib/policyStore";
// relationship.ts pulls the browser SDK (@tidecloak/js, heimdall-tide). It is imported lazily in POST
// so that, if it cannot evaluate on the server, GET keeps working and POST still runs the structural
// checks. Role names are fixed by Tide (SPEC section 2).
const ENCRYPT_ROLE = "_tide_encryptor";
const DECRYPT_ROLE = "_tide_decryptor";
type Describe = typeof import("@/lib/tide/relationship").describeRelationshipPolicy;
let describeImportFailed = false;

// The four policies of SPEC section 3. A policy id fixes its record, subject and access.
const EXPECTED: Record<string, Omit<PolicyEntry, "policy">> = {
  "owner:mai-care": { recordId: "mai-care", subject: { type: "Role", id: "vault-owner-mai" }, access: "read-write" },
  "owner:mai-bank": { recordId: "mai-bank", subject: { type: "Role", id: "vault-owner-mai" }, access: "read-write" },
  "heir:mai-care": { recordId: "mai-care", subject: { type: "Role", id: "heir-care-mai" }, access: "read" },
  "heir:mai-bank": { recordId: "mai-bank", subject: { type: "Role", id: "heir-bank-mai" }, access: "read" },
};
const RECORDS = ["mai-care", "mai-bank"];
const ROLES_FOR: Record<PolicyEntry["access"], string[]> = {
  read: [DECRYPT_ROLE],
  write: [ENCRYPT_ROLE],
  "read-write": [ENCRYPT_ROLE, DECRYPT_ROLE],
};

const fail = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

// GET /api/policies?record=mai-bank -> { owner, heir } (base64 or null)
export const GET = withAuth(async (req: NextRequest) => {
  const record = req.nextUrl.searchParams.get("record") ?? "";
  if (!RECORDS.includes(record)) return fail(422, "VALIDATION", `unknown record "${record}"`);
  const all = readPolicies();
  return Response.json({
    owner: all[`owner:${record}`]?.policy ?? null,
    heir: all[`heir:${record}`]?.policy ?? null,
  });
});

// POST /api/policies (tide-realm-admin) {policyId, recordId, subject:{type:"Role",id}, access, policy}
export const POST = withClientRole("realm-management", "tide-realm-admin", async (req: NextRequest) => {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail(422, "VALIDATION", "body is not JSON");
  }
  const { policyId, recordId, subject, access, policy } = body as {
    policyId?: unknown; recordId?: unknown; subject?: { type?: unknown; id?: unknown }; access?: unknown; policy?: unknown;
  };

  const want = typeof policyId === "string" ? EXPECTED[policyId] : undefined;
  if (!want) return fail(422, "VALIDATION", `policyId must be one of ${Object.keys(EXPECTED).join(", ")}`);
  if (recordId !== want.recordId) return fail(422, "VALIDATION", `${policyId} is for record ${want.recordId}`);
  if (subject?.type !== "Role" || subject?.id !== want.subject.id) {
    return fail(422, "VALIDATION", `${policyId} is for Role ${want.subject.id}`);
  }
  if (access !== want.access) return fail(422, "VALIDATION", `${policyId} grants ${want.access}`);
  if (typeof policy !== "string" || !policy) return fail(422, "VALIDATION", "policy (base64) is required");

  // Parse the signed policy itself: the body is only a claim about it (AP-RA08).
  let describeRelationshipPolicy: Describe | null = null;
  try {
    describeRelationshipPolicy = (await import("@/lib/tide/relationship")).describeRelationshipPolicy;
  } catch (err) {
    if (!describeImportFailed) {
      describeImportFailed = true;
      console.error("[api/policies] relationship.ts cannot load on the server; structural checks only (the page decodes before posting):", err);
    }
  }
  if (!describeRelationshipPolicy) {
    writePolicy(policyId as string, { ...want, policy });
    return Response.json({ ok: true, decoded: false });
  }

  let d: ReturnType<Describe>;
  try {
    d = describeRelationshipPolicy(policy);
  } catch (err) {
    return fail(422, "VALIDATION", `policy does not decode: ${err instanceof Error ? err.message : String(err)}`);
  }
  let roles: unknown = null;
  try {
    roles = JSON.parse(d.roles);
  } catch {
    /* checked below */
  }
  const rolesOk =
    Array.isArray(roles) &&
    roles.length === ROLES_FOR[want.access].length &&
    ROLES_FOR[want.access].every((r) => (roles as unknown[]).includes(r));
  if (
    !d.isRelationshipPolicy ||
    !d.signed ||
    d.recordId !== want.recordId ||
    d.subjectType !== "Role" ||
    d.subjectId !== want.subject.id ||
    d.clientId !== "" ||
    !rolesOk
  ) {
    return fail(
      422,
      "VALIDATION",
      `signed policy does not match ${policyId}: contract=${d.contractId} signed=${d.signed} record=${d.recordId} subject=${d.subjectType}:${d.subjectId} clientId=${d.clientId} roles=${d.roles}`,
    );
  }

  writePolicy(policyId as string, { ...want, policy });
  return Response.json({ ok: true });
});
