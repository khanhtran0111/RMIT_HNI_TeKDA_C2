import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { calculateJwkThumbprint, exportJWK, generateKeyPair, SignJWT } from "jose";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/items/route";
import { GET as operatorGet } from "../src/app/api/operator/store/route";

const original = process.cwd();
const temporary = mkdtempSync(join(tmpdir(), "heirloom-api-"));
let issuerKey: Awaited<ReturnType<typeof generateKeyPair>>;
let dpopKey: Awaited<ReturnType<typeof generateKeyPair>>;
let thumbprint: string;
before(async () => {
  issuerKey = await generateKeyPair("EdDSA");
  const jwk = { ...await exportJWK(issuerKey.publicKey), kid: "test-issuer" };
  process.env.CLIENT_ADAPTER = JSON.stringify({ realm: "heirloom", resource: "heirloom-client", "auth-server-url": "http://localhost:8080", jwk: { keys: [jwk] } });
  dpopKey = await generateKeyPair("ES256");
  thumbprint = await calculateJwkThumbprint(await exportJWK(dpopKey.publicKey));
  process.chdir(temporary);
});
after(() => { process.chdir(original); delete process.env.CLIENT_ADAPTER; rmSync(temporary, { recursive: true, force: true }); });
async function request(path: string, method: string, roles: string[], body?: string, proof = true) {
  const token = await new SignJWT({ preferred_username: "mai", azp: "heirloom-client", realm_access: { roles }, cnf: { jkt: thumbprint } })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-issuer" }).setIssuer("http://localhost:8080/realms/heirloom").setIssuedAt().setExpirationTime("5m").sign(issuerKey.privateKey);
  const headers: Record<string, string> = { Authorization: `${proof ? "DPoP" : "Bearer"} ${token}`, "Content-Type": "application/json" };
  if (proof) headers.DPoP = await new SignJWT({ htu: `http://localhost:3000${path}`, htm: method, ath: createHash("sha256").update(token).digest("base64url") })
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: await exportJWK(dpopKey.publicKey) }).setIssuedAt().setJti(randomUUID()).sign(dpopKey.privateKey);
  return new NextRequest(`http://localhost:3000${path}`, { method, headers, ...(body !== undefined ? { body } : {}) });
}

test("unauthenticated and plain bearer requests are refused with the contracted error shape", async () => {
  for (const req of [new NextRequest("http://localhost:3000/api/items"), await request("/api/items", "GET", [], undefined, false)]) {
    const response = await GET(req);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
  }
});
test("authenticated recipient reads ciphertext, but cannot write items or read operator files", async () => {
  const read = await GET(await request("/api/items", "GET", ["_tide_decryptor"]));
  const write = await POST(await request("/api/items", "POST", ["_tide_decryptor"], "{}"));
  const operator = await operatorGet(await request("/api/operator/store", "GET", ["_tide_decryptor"]));
  assert.equal(read.status, 200);
  assert.equal(write.status, 403);
  assert.equal(operator.status, 403);
});
test("owner validation returns 422 and leaves the store empty for invalid requests", async () => {
  for (const body of ["not json", "{}", JSON.stringify({ recordId: "unknown", title: "t", recipientUsername: "ops", ciphertext: "c" })]) {
    const response = await POST(await request("/api/items", "POST", ["vault-owner-mai"], body));
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "VALIDATION");
  }
  assert.deepEqual((await (await GET(await request("/api/items", "GET", []))).json()).items, []);
});
test("an authenticated owner stores ciphertext and an operator receives only allowed files", async () => {
  const response = await POST(await request("/api/items", "POST", ["vault-owner-mai"], JSON.stringify({ recordId: "mai-bank", title: "Bank", recipientUsername: "long", ciphertext: "ZW5jcnlwdGVk" })));
  assert.equal(response.status, 201);
  const item = (await response.json()).item;
  assert.equal(item.ownerUsername, "mai");
  assert.equal(item.ciphertext, "ZW5jcnlwdGVk");
  const snapshot = await operatorGet(await request("/api/operator/store", "GET", ["operator"]));
  assert.equal(snapshot.status, 200);
  const body = await snapshot.json();
  assert.deepEqual(Object.keys(body.files), ["items.json", "policies.json"]);
  assert.equal(body.files["items.json"][0].id, item.id);
  assert.ok(!readFileSync(join(temporary, "data", "heirloom", "items.json"), "utf8").includes("content"));
});
test("item recipient must match the signed record policy; a mismatch never writes", async () => {
  const before = (await (await GET(await request("/api/items", "GET", []))).json()).items;
  for (const [recordId, recipientUsername] of [["mai-bank", "linh"], ["mai-care", "long"]]) {
    const response = await POST(await request("/api/items", "POST", ["vault-owner-mai"], JSON.stringify({ recordId, recipientUsername, title: "Wrong recipient", ciphertext: "ZW5jcnlwdGVk" })));
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "VALIDATION");
  }
  assert.deepEqual((await (await GET(await request("/api/items", "GET", []))).json()).items, before);
});
