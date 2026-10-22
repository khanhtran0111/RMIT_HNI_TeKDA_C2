# Heirloom - shared build spec (v1, 22 Oct 2026 12:45, locked for both devs)

Read this whole file once (Part 1 = what we build; Part 2 = tasks per dev). This is the only project document in git; everything else stays on Dev A's machine.
Change control: anything in sections 3-7 is a contract between the two devs. To change it, edit this file first, then say "SPEC changed: <section>" in the team chat. Nothing else counts.

## 1. The idea in one paragraph
Mai, 68, has an early dementia diagnosis. While she is still lucid she seals, in her own browser, the things her family will need when she can no longer decide: her care wishes for her daughter Linh (a doctor), and her bank and pension logins for her son Long. Each item has one named recipient. The company that runs Heirloom stores only ciphertext and can neither read nor release anything. A release happens only when 2 of 3 independent seats (her family doctor, her notary, a friend she chose) approve it in the Tide enclave; the company is not a seat. Even after a release each child opens only their own item: Long opens the bank logins and is still refused on the care wishes.

**README one-liner:** Heirloom lets a person seal what their family will need if they lose capacity or die, so that no company, no single relative and no single seat can open or release it alone, and each item reaches only the person it was meant for.

**What a lone party can no longer do (the "why TideCloak" claims; each has on-screen evidence in section 6):**
| Party | Can no longer | Enforced by | Evidence on screen |
| --- | --- | --- | --- |
| The operator (runs server, DB, Docker host) | read any item, even holding every byte and every policy | Tide network: every node checks the `RelationshipAttestation:1` policy | Operator view: "Try to open" -> `0 of N nodes` |
| One child (Long) | open his item before release, or open his sister's item after it | same contract: the caller must hold the item's heir role | Heir view: refused before; refused on `mai-care` after |
| One seat (the doctor) | release anything alone | TideCloak quorum: 3 `tide-realm-admin`, threshold 2 | Change request "Pending 1 of 2" |
| The operator, again | make itself a seat or grant a role | it is not a realm admin; TideCloak answers 403 to its role-mapping call, and even a seat needs a second seat | Operator view: "Try to release to Long" -> `403 from TideCloak: not a seat` (beat 3a, second click) |

**Honest limits (go in README verbatim):** capacity or death is a human judgement backed by a mocked document; Heirloom cannot make a bank or Apple open an account, it passes on what Mai stored; nothing un-reads what an heir has read; 2 of 3 seats colluding can release early, which is why no seat is the company or a recipient.

## 2. Cast, realm, roles (synthetic, fixed names)
Realm `heirloom`, client `heirloom-client`, app `http://localhost:3000`, TideCloak `http://localhost:8080` (Dev A's machine). All people are fictional.

| Username | Who | Realm roles at setup | Gets at release | tide-realm-admin | Browser profile (owner) |
| --- | --- | --- | --- | --- | --- |
| `notary-duc` | Mai's notary, **seat 1, first admin** (created by `npm run init`) | - | - | yes | A-1 |
| `dr-hanh` | family doctor, seat 2 | - | - | yes | A-2 |
| `thu` | Mai's chosen friend, seat 3 | - | - | yes | A-3 |
| `mai` | owner | `vault-owner-mai`, `_tide_encryptor`, `_tide_decryptor` | - | no | B-1 |
| `linh` | daughter, recipient of `mai-care` | `_tide_decryptor` | `heir-care-mai` | no | B-2 |
| `long` | son, recipient of `mai-bank` | `_tide_decryptor` | `heir-bank-mai` | no | B-3 |
| `ops` | Heirloom Pty Ltd operations (runs the server) | `operator` | never | **no** | B-4 |

Rules that come from Tide canon (do not argue with them, they are measured):
- `_tide_encryptor` / `_tide_decryptor` are **realm** roles with fixed names and must **not** be in the default-roles composite.
- `tide-realm-admin` is a **client** role of `realm-management`. Threshold = `max(1, floor(0.7 x admins))` = **2 with 3 admins**. The filer of a change request may approve it, and each admin counts once, so one seat alone stops at 1 of 2.
- Grant `tide-realm-admin` to `dr-hanh` and `thu` **last** (one-way door: after that every governed change needs 2 enclave approvals).
- Approvals go **browser -> TideCloak with the seat's own token**, never through our server (AP-89: proxied approvals are credited to the server identity and stick at 1 of 2).
- Role changes reach a user on their **next sign-in**. In the demo, sign out and back in.

## 3. Records and policies (the contract with the Tide network)
One record per item. The record id is the **only tag** on every encrypt/decrypt call. Policies use the built-in contract `RelationshipAttestation:1` (nothing is written, compiled or deployed). All four are signed once at setup by `notary-duc` on `/setup`, while the realm still has one admin.

| Policy id | Record (tag) | Subject | Access | Meaning |
| --- | --- | --- | --- | --- |
| `owner:mai-care` | `mai-care` | Role `vault-owner-mai` | `read-write` | Mai seals and re-reads her care wishes |
| `owner:mai-bank` | `mai-bank` | Role `vault-owner-mai` | `read-write` | Mai seals and re-reads the bank logins |
| `heir:mai-care` | `mai-care` | Role `heir-care-mai` | `read` | whoever holds `heir-care-mai` can read the care wishes |
| `heir:mai-bank` | `mai-bank` | Role `heir-bank-mai` | `read` | whoever holds `heir-bank-mai` can read the bank logins |

Optional third item (polish only): `mai-letter`, recipient Linh, roles `heir-letter-mai`, two more policies.

**Release = one governed role grant**: `POST /admin/realms/heirloom/users/{userId}/role-mappings/realm` with `[{heir-bank-mai}]`, sent from a seat's browser. TideCloak answers **202** and creates a `GRANT_ROLES` change request. It commits when 2 seats have approved (`POST /iga/change-requests/{id}/approve`, two-phase enclave signing). **Revocation** is the same with `DELETE`, also a change request, so no child keeps access by inertia (README claim; demo only if time).

Refusals arrive as `TIDE-TIDEJS-NET-THRESHOLD_FAILURE: Could not reach enough VVK ORKs (got 0 of N required)` with the contract reason in `error.cause`, e.g. `'heir-care-mai' role not found in doken.` **That is the refusal, not an outage.** The app never retries it and never says "service unavailable".

## 4. Architecture
Template: Tide pack `nextjs-e2ee-vault` already copied to `app/` (Next.js 16, route handlers, DPoP wired, server-side EdDSA JWT + DPoP verification in `src/lib/auth/`). SDK pins: `@tidecloak/nextjs 0.14.40`, `@tidecloak/js 0.14.41`, `heimdall-tide 0.14.41`, `@tideorg/js 0.14.29` (npm latest 22 Oct; floor 0.14.17). Helper: `.tide-pack/templates/relationship-attestation/relationship.ts` copied to `app/src/lib/tide/relationship.ts` **unchanged**.

```
Mai's browser      --encryptForRecord(text, "mai-bank", ownerPolicy)-->  ciphertext --> POST /api/items --> data/heirloom/items.json
Heir's browser     <--decryptForRecord(ct, "mai-bank", heirPolicy)--   ciphertext   (ORKs check policy + tag + role on every call)
Operator's browser <--decryptForRecord(ct, "mai-bank", heirPolicy)--   same call, NO app check, refused by the network
Seat's browser     --POST role-mappings / --POST iga/.../approve-->  TideCloak (direct, DPoP token; slice 1: TideCloak console does this)
data/heirloom/policies.json <-- /setup (notary signs 4 policies, enclave popup each)
```
- No database: `data/heirloom/items.json`, `data/heirloom/policies.json` (`data/` is gitignored). Viewing these files raw is itself a demo beat.
- No custom contract, no Forseti, no backend service, no file upload.
- **Design system**: tokens and fonts are in `app/src/app/globals.css` (use them unchanged) (warm paper, refused red `#B42318`, pending amber `#8A4B00`, approved green `#1D6B3A`; every state = icon + word). Only the copy changes.

### Stack options considered (rule: always 3)
| | Cheap | Medium | Strong |
| --- | --- | --- | --- |
| Shape | self-encryption only (`_tide_vault.selfdecrypt`): Mai seals, nobody else can ever read; release = re-grant Mai her own role | **record policies (M7) + 3 seats; approvals in the TideCloak console** | Medium + in-app seats panel (list / approve via enclave / deny) |
| Hours to proof moment | ~1.5 | ~2.5 | ~4 |
| Loses | the whole idea (heirs can never read) | nothing in the story; approvals happen in TideCloak's own UI, which is also honest | - |
| Risk | - | contract availability on the production network (assumed since 16 Oct); test at T+45 min | enclave `requestModel` signing call not documented for apps |
**Spec assumption: slice 1 = Medium, slice 2 = the Strong panel, cut without changing the story.** Team vetoes in one line if not agreed.

## 5. Pages and API (locked)
Auth on every API route: template `withAuth` / `withRole` (verifies EdDSA JWT + DPoP proof + role). Browser calls to our API use the SDK's DPoP-aware fetch (plain `fetch` gets 401). Error shape: `{ "error": { "code": "UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION", "message": "..." } }` with 401/403/404/422.

### Pages
| Path | Who (UI gate only; API is the real check) | Must show | Calls |
| --- | --- | --- | --- |
| `/` | everyone | sign in; after sign-in: username, realm roles, links to the pages the roles allow, "SYNTHETIC DATA" badge | - |
| `/vault` | `vault-owner-mai` | Mai's items (title, recipient, status, ciphertext preview); form Seal {title, recipient: linh\|long, content}; "Seal demo items" button that seals the two fixtures in one go; "Open" per item (owner policy) | `encryptForRecord`, `decryptForRecord` with `owner:*` policy; POST/GET `/api/items` |
| `/heir` | `linh`, `long` | items addressed to me: status Sealed / Released to me; "Open" -> plaintext or the **refusal panel** | `decryptForRecord` with `heir:*` policy; GET `/api/items`, `/api/policies` |
| `/operator` | `operator` | "Everything Heirloom stores": raw `items.json`, `policies.json`, the signed policies decoded (`describeRelationshipPolicy`), the list of user keys; per item **"Try to open"** which calls `decryptForRecord` with the heir policy and **no app-side check** -> refusal panel with raw `message` + `cause` | `decryptForRecord`; GET `/api/operator/store` |
| `/seats` | `tide-realm-admin` (client role) | slice 1: the rules of the vault (decoded policies), the seat list "doctor, notary, friend: 2 of 3 needed, Heirloom has no seat", a link to the TideCloak console Change Requests page and the exact steps; slice 2: pending change requests with Approve (enclave) / Deny, and "Release <item> to <recipient>" buttons | slice 2: direct TideCloak calls with the seat's token |
| `/setup` | `tide-realm-admin`, one-time | 4 buttons "Sign owner:mai-care" ... each calling `signRelationshipPolicy` **inside the click handler** (popup must not be blocked); shows `Models.Policy.latestVersion`; "Test refusal markers" box | `signRelationshipPolicy`; POST `/api/policies`; GET `/api/admin-policy` |

**Refusal panel** (shared component, used on `/heir` and `/operator`): red band "Refused by the Tide network", the line `0 of N nodes would release this key` (N parsed from the message), the contract reason from `error.cause` in monospace, and a "Show raw error" toggle. Grey band "Cannot reach the Tide network, try again" **only** when the error matches the outage marker captured at setup (`src/lib/tide/refusal.ts`). Never retries.

### API
| Method | Path | Role | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | - | - | `{ok:true}` |
| GET | `/api/items` | any authenticated | - | `{items:[Item]}` (ciphertext only; no plaintext ever) |
| POST | `/api/items` | `vault-owner-mai` | `{recordId:"mai-care"\|"mai-bank", title, recipientUsername, ciphertext}` | `{item:Item}` 201 |
| GET | `/api/policies?record=mai-bank` | any authenticated | - | `{owner:"<b64>", heir:"<b64>"}` (a policy only works for its subject; returning it reveals who may read, documented trade-off) |
| POST | `/api/policies` | `tide-realm-admin` | `{policyId, recordId, subject:{type:"Role",id}, access, policy:"<b64>"}` | `{ok:true}`; server parses the policy with `describeRelationshipPolicy` and rejects if contract/record/subject do not match |
| GET | `/api/admin-policy` | `tide-realm-admin` | - | `{adminPolicy:"<b64>"}` fetched server-side from `GET {auth-server-url}/admin/realms/heirloom/iga/role-policies/name/tide-realm-admin` with the caller's token forwarded; if TideCloak rejects the forwarded token (DPoP), `/setup` fetches it from the browser instead (Dev A decides at bootstrap and tells Dev B) |
| GET | `/api/operator/store` | `operator` | - | `{files:{"items.json":..., "policies.json":...}}` raw |
| GET | `/api/directory` | `tide-realm-admin` | - | `{users:[{username, id}]}` from TideCloak admin API (slice 2 release button) |

```json
// Item
{ "id": "uuid", "recordId": "mai-bank", "title": "Bank and pension logins", "recipientUsername": "long",
  "ownerUsername": "mai", "ciphertext": "<base64>", "createdAt": "ISO" }
// policies.json
{ "owner:mai-care": {"recordId":"mai-care","subject":{"type":"Role","id":"vault-owner-mai"},"access":"read-write","policy":"<b64>"}, ... }
```

## 6. Demo beats and the proof-moment procedure
Recorded on Dev A's PC, Chrome or Edge (never the VS Code browser), 1080p, pop-ups allowed for localhost:3000 and localhost:8080. Profiles per the cast table.
1. **0:00-0:20 Possibility.** `/vault` as `mai`: two sealed items, each with a recipient. "While she can still decide, Mai decides."
2. **0:20-0:40 Constraint.** Title card: every legacy service today has one party who can read or release: the company, a timer, or one relative. 55% of elder financial abuse involves family (MetLife 2009).
3. **0:40-1:35 Prototype, the proof moment.**
   - (a) `ops` on `/operator`: everything the company stores, raw. "Try to open" `mai-bank` -> **Refused by the Tide network, 0 of N nodes**, raw cause shown. Hold 3 s. Then "Try to release to Long" (the same role-mapping POST a seat would send, with the operator's own token) -> **403 from TideCloak: not a seat**.
   - (b) `long` on `/heir`: "Open" bank logins -> refused (`'heir-bank-mai' role not found in doken.`).
   - (c) `dr-hanh` (seat) files "Release bank logins to Long" and approves it -> **Pending 1 of 2**. `long` signs out/in, retries -> still refused.
   - (d) `notary-duc` approves with the mocked capacity assessment attached as a comment -> **Approved, committed**. `long` signs out/in -> **opens the bank logins**; clicks care wishes -> **refused**. `linh` opens care wishes (released in a second request before recording, or shown as still sealed: Dev A chooses, script says which).
   - Optional (e) `thu` denies a wrong request ("release care wishes to Long") -> Denied.
4. **1:35-2:00 What changes.** Split screen: Long reading the logins next to the operator's raw ciphertext. "Nobody held the key in the meantime: not Heirloom, not one child, not one seat."

Exact clicks and expected strings are the ones in this section; Dev A keeps the narration and reset notes locally. Slice-1 fallback: beats (c)-(e) happen in the TideCloak console (`http://localhost:8080/admin/heirloom/console/` -> Change Requests) in each seat's own profile.

## 7. Bootstrap order (Dev A; one-way doors marked)
Facts: `.env` already holds `TIDE_LICENSE_EMAIL`, `TIDE_TERMS_ACCEPTED=yes`, `KC_BOOTSTRAP_ADMIN_PASSWORD`. Docker Desktop and the `tideorg/tidecloak-dev` image are on this PC. Pack files are in `.tide-pack/` (gitignored).
1. Edit `app/scripts/realm.json.template`: add realm roles `vault-owner-mai`, `heir-care-mai`, `heir-bank-mai`, `operator` (declared before IGA, so they are adopted without approval). Keep `_tide_encryptor`/`_tide_decryptor` out of default roles. Keep redirect URIs `http://localhost:3000/*`.
2. `cd app && npm install && REALM_NAME=heirloom CLIENT_NAME=heirloom-client npm run init`. The first admin it creates **is** `notary-duc` (set the script's admin username variable; if it is fixed, keep that name and update the cast table). Open the invite link in profile A-1. Answer the two pack questions: branding = none, onboarding form = none (users carry no name; the app shows usernames).
3. Export is automatic (`data/tidecloak.json`, must contain `jwk`, `vendorId`, `homeOrkUrl`). Hand a copy to Dev B privately (not git) with `auth-server-url` rewritten to `http://<A-LAN-IP>:8080`.
4. In the TideCloak console (as `notary-duc`): enable user registration (change request, approve). Each profile signs up at `http://localhost:3000` with the username from the cast table (7 identities; budget 35 min; time the first one). Approve any `CREATE_USER` requests in a batch.
5. Grant the setup roles from the cast table (batch approve, threshold still 1). Everyone signs out and in.
6. `/setup` as `notary-duc`: sign the 4 policies. **If signing fails with an unknown contract, stop and tell the team: the network lacks `RelationshipAttestation:1`; fallback = Cheap option, story shrinks to "nobody but Mai can read; release = re-grant" and the README says so.**
7. **Phase-7 checks** (must all hold before anything else): `mai` seals and re-opens `mai-bank` (round-trip); `long` opens `mai-bank` -> refused; `ops` opens -> refused; a 2-tag encrypt -> refused. Then: turn Wi-Fi off, `long` opens -> copy the error; Wi-Fi on. Put both strings in `src/lib/tide/refusal.ts`.
8. **One-way door:** grant `tide-realm-admin` to `dr-hanh`, then `thu` (approve the `REGEN_ADMIN_POLICY` requests that follow). File a harmless test request and confirm it shows **1 of 2**; deny it.
9. **Bootstrap-admin test (10 min, honesty):** in a private window, master `admin` grants `heir-bank-mai` to `long`. Outcome 1: it becomes a PENDING change request -> quorum covers it, deny it. Outcome 2: role shows granted but `long` is still refused after re-login -> the network ignores it, remove it. Outcome 3: `long` can open -> disable the `admin` user in the `master` realm before recording, or write in README "dev container only: the bootstrap account sits outside the quorum". Dev A records the outcome locally and tells Dev B in one line.
10. Save evidence screenshots locally (not in git): login, 401 on plain fetch, refused decrypt, 1 of 2 pending.

## 8. Timeline (hard clock, Vietnam time)
| Time | Dev A | Dev B | Gate |
| --- | --- | --- | --- |
| 12:50-14:00 | bootstrap steps 1-7 (enrolment is the long pole) | pages `/`, `/vault`, `/heir`, `/operator`, API routes, stores, refusal panel, fixtures, against the contract; LAN test from 13:30 | |
| 14:00-14:30 | steps 8-10, evidence | integrate: proof beats (a)-(d) end to end on A's PC | **14:30 proof moment runs end to end** |
| 14:30-15:30 | `/seats` panel (slice 2) if the enclave signing call is documented; else console script + reset script | polish copy, split-screen layout, "Seal demo items", optional letter item | 15:30 slice 2 |
| 15:30-16:00 | rehearsal, reset | README draft (5 prompts, <= 300 words) | **16:00 code freeze** |
| 16:00-17:00 | record | README final (<= 300 words in the overview) | |
| 17:00-17:30 | encode < 100 MB, commit video, push | fresh-subagent clean-checkout run | 17:30 submit form |
Timebox rule: a task 1.5x over its estimate stops; say so in chat; run `/stuck`.

**Cut list, in order:** (e) deny beat; third item; `/api/directory`; "Seal demo items" (Mai types); split-screen layout; `/seats` panel (console instead, last resort).

**Judge feedback applied (fresh judge on this spec, 13:05: 70/100, ordinary-login PASS):** (1) the console fallback for beats 3c-3d reads as an IAM dashboard, so the `/seats` panel moves up the priority list and any console shot stays under 10 s with the enclave popup in frame; (2) "the operator cannot make itself a seat" is now demoed (beat 3a second click), not stated; (3) the constraint card cites the 2026 UK survey (only 10% have a digital-asset plan; 5% over 55) next to the MetLife family-abuse share; (4) README and narration say "no single party", never "only when she is incapable": capacity is a human judgement by the seats, backed by a mocked document.

## 9. Git workflow (two devs, one repo)
- Remote: `https://github.com/khanhtran0111/RMIT_HNI_TeKDA_C2` (private now; **owner makes it public before 17:30**).
- `main` is always runnable. Branches: `a/realm` (Dev A), `b/ui` (Dev B). Commit every 20-30 min with a one-line message. Before every push: `git pull --rebase origin main`; then merge your branch into `main` with a fast-forward or a PR with no review. Never force-push `main`.
- **Path ownership** (no conflicts by construction): Dev A owns `app/scripts/`, `app/src/app/setup/`, `app/src/app/seats/`, `app/src/lib/tide/`, `app/src/app/api/policies/`, `app/src/app/api/admin-policy/`, `app/src/app/api/directory/`. Dev B owns `app/src/app/page.tsx`, `app/src/app/vault/`, `app/src/app/heir/`, `app/src/app/operator/`, `app/src/app/api/items/`, `app/src/app/api/operator/`, `app/src/components/`, `app/src/lib/store.ts`, `demo/fixtures/`, `README.md`. Shared: `docs/SPEC.md` (announce before editing). Only `app/`, `docs/SPEC.md`, `demo/fixtures/heirloom.json`, `.gitignore` (and later `README.md` + the video) are in git.
- **What goes to GitHub (team rule):** only `app/`, `docs/SPEC.md`, `docs/split.md`, `demo/fixtures/heirloom.json`, `.gitignore`, and at the end `README.md` + the `.mp4`. Every other doc stays on Dev A's machine. The root `.gitignore` enforces it (whitelist).
- Never commit: `.env`, `data/`, `app/data/tidecloak.json`, `.tide-pack/`, `*.mv.db`, screenshots with real names. `git status` before every push.
- Dev B's local run: clone, `cd app && npm install`, place the `tidecloak.json` Dev A sent at `app/data/tidecloak.json`, `npm run dev`. If login over LAN fails within 10 minutes (HTTPS-required or enclave error), stop trying: Dev B keeps building against the contract and tests only on Dev A's PC from 13:30.

## 10. Verification before "done"
- Proof beats (a)-(d) run end to end on Dev A's PC with the exact strings in section 6.
- A fresh subagent follows README setup from a clean checkout and reaches beat (a).
- README overview <= 300 words; video .mp4 < 100 MB, <= 2:00, committed at the repo root (Dev A runs the checks locally).
- Nothing in git that `git check-ignore` should have caught.

---

# Part 2. Tasks per dev


**Goal:** The proof moment of Heirloom runs end to end by 14:30: the operator and a son are refused by the Tide network, one seat's release stalls at 1 of 2, two seats release, the son opens his item and is still refused on his sister's.

**Architecture:** Tide pack template `nextjs-e2ee-vault` in `app/` + the pack helper `relationship.ts` (built-in contract `RelationshipAttestation:1`, one policy per role and record) + TideCloak quorum (3 `tide-realm-admin`, threshold 2). JSON files under `data/heirloom/`. Approvals in the TideCloak console for slice 1, in-app panel for slice 2.

**Tech Stack:** Next.js 16 route handlers, `@tidecloak/nextjs 0.14.40`, `@tidecloak/js 0.14.41`, `heimdall-tide 0.14.41`, `@tideorg/js 0.14.29`, `jose`, TideCloak dev in Docker Desktop on Dev A's PC.

**Spec:** Part 1 above (read sections 2, 3, 5 before any task).

### Global Constraints
- Record id is the **only** tag on every `encryptForRecord` / `decryptForRecord` call: `mai-care` or `mai-bank`.
- `relationship.ts` is copied from `.tide-pack/templates/relationship-attestation/` **unchanged**; `tide_dpop_auth.html` is never retyped.
- `_tide_encryptor` / `_tide_decryptor` are realm roles, never default roles. `tide-realm-admin` is a client role of `realm-management`.
- Every API route goes through `withAuth` / `withRole` from `src/lib/auth/middleware.ts`. A UI gate is not authorization.
- Browser calls to our API and to TideCloak use the SDK's DPoP-aware fetch; approvals never pass through our server.
- A `TIDE-TIDEJS-NET-THRESHOLD_FAILURE` error is shown as a refusal with its `cause`; never retried, never called an outage unless it matches the outage marker.
- Copy: states always carry icon + word (REFUSED / PENDING / RELEASED / SEALED). A "SYNTHETIC DATA" badge on every page.
- Never commit `.env`, `data/`, `app/data/tidecloak.json`, `.tide-pack/`, screenshots. Only `app/`, `docs/SPEC.md`, `demo/fixtures/heirloom.json`, `.gitignore` (and later `README.md` + the video) go to GitHub.
- Role checks: `hasRole` in the template's `tideJWT.ts` accepts a role from ANY client in `resource_access` (flagged by security review). In Task A3, change it to check `realm_access.roles` only, and add `hasClientRole(jwt, client, role)` that reads `resource_access[client].roles` only.

### Review Focus
1. A user whose role was granted but who has not signed in again is refused (`'heir-bank-mai' role not found in doken.`): `/heir` must show "sign out and back in after a release" next to the refusal. (Task B3)
2. A refusal error whose `cause` is missing or not a string must still render the panel with the raw `message`. (Task B2)
3. `POST /api/items` with a `recordId` outside `{mai-care, mai-bank}` or a recipient outside `{linh, long}` returns 422, never writes. (Task B1)
4. `POST /api/policies` with a policy whose decoded `recordId`/`subjectId` differ from the body returns 422 (AP-RA08). (Task A4)
5. Plain `fetch` without the DPoP proof to any `/api/*` route returns 401, which the `/operator` page must show as "the app's own API refused" and not as a Tide refusal. (Task B4)

---

### Track A (Dev A: Vinh, this PC, TideCloak owner)

### Task A1: Realm template and bootstrap
**Files:** Modify `app/scripts/realm.json.template`, `app/scripts/init-tidecloak.sh` (admin username only), `app/.gitignore`.
**Interfaces:** Produces `app/data/tidecloak.json` (with `jwk`, `vendorId`, `homeOrkUrl`), realm `heirloom`, client `heirloom-client`, realm roles `vault-owner-mai`, `heir-care-mai`, `heir-bank-mai`, `operator`, `_tide_encryptor`, `_tide_decryptor`.
- [ ] Step 1: In `realm.json.template`, add the four app roles to `roles.realm`; confirm `_tide_encryptor` and `_tide_decryptor` are not in `default-roles-REALM_NAME.composites.realm`; confirm redirect URIs include `http://localhost:3000/*` and webOrigins `http://localhost:3000`.
- [ ] Step 2: Set the first admin username to `notary-duc` in the init script (search `ADMIN_USER`); if the script derives it from the licence email, leave it and update the cast table in section 2 of this file.
- [ ] Step 3: Run `cd app && npm install && REALM_NAME=heirloom CLIENT_NAME=heirloom-client npm run init`; open the invite link in profile A-1; answer branding = none, onboarding = none.
- [ ] Step 4: Verify: `jq 'has("jwk") and has("vendorId") and has("homeOrkUrl")' app/data/tidecloak.json` prints `true`; `curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/realms/heirloom` prints 200.
- [ ] Step 5: Note realm, ports, console URL and which browser profile holds which identity in a local file (not git). Commit the template changes: `git commit -m "Realm heirloom bootstrapped"`.

### Task A2: Seven identities and setup roles
**Files:** none in git.
**Interfaces:** Produces users per section 2 with their setup roles; everyone has signed in once.
- [ ] Step 1: Console as `notary-duc` (`http://localhost:8080/admin/heirloom/console/`): enable user registration; approve the change request. Time this and the first sign-up.
- [ ] Step 2: In each profile, sign up at `http://localhost:3000` with the cast username. Order: `dr-hanh`, `thu`, `mai`, `long`, `linh`, `ops`. Batch-approve `CREATE_USER` requests.
- [ ] Step 3: Grant setup roles from the cast table (not the admin role yet). Batch-approve. Every profile signs out and in.
- [ ] Step 4: Verify: in profile B-1 the `/` page lists `vault-owner-mai`, `_tide_encryptor`, `_tide_decryptor` for `mai`. Note timings locally.

### Task A3: `relationship.ts`, refusal markers, admin policy route
**Files:** Create `app/src/lib/tide/relationship.ts` (copy), `app/src/lib/tide/refusal.ts`, `app/src/app/api/admin-policy/route.ts`.
**Interfaces:** Produces `classifyTideError(err: unknown): { kind: "refused"|"outage"|"unknown"; message: string; cause: string; nodes?: {got:number; required:number} }` and `REFUSAL_MARKER`, `OUTAGE_MARKER` constants; `GET /api/admin-policy -> {adminPolicy: string}`.
- [ ] Step 1: `cp .tide-pack/templates/relationship-attestation/relationship.ts app/src/lib/tide/`; `npm run build` type-checks (fix only import paths, never the helper's logic; if the SDK types disagree, record it and ask `tide_doctor`).
- [ ] Step 2: Write `refusal.ts` with `classifyTideError` parsing `got (\d+) of (\d+)` from `message` and reading `cause` (string or `{message}`); markers are empty strings until Task A5 step 2 fills them.
- [ ] Step 3: Write `/api/admin-policy` with `withRole("tide-realm-admin-client", ...)`: check `resource_access["realm-management"].roles` includes `tide-realm-admin` (it is a client role; `hasRole` from the template checks realm roles only, so add `hasClientRole` in `tideJWT.ts`). Fetch `GET {auth-server-url}/admin/realms/heirloom/iga/role-policies/name/tide-realm-admin` with the caller's bearer token; return `{adminPolicy: body.policy}`. If TideCloak answers 400/401 because of DPoP, return 501 and switch `/setup` to fetch from the browser (Task A4).
- [ ] Step 4: Verify: `curl` without a token to `/api/admin-policy` -> 401. Commit.

### Task A4: `/setup` and `/api/policies`
**Files:** Create `app/src/app/setup/page.tsx`, `app/src/app/api/policies/route.ts`, `app/src/lib/policyStore.ts`.
**Interfaces:** Consumes `signRelationshipPolicy`, `describeRelationshipPolicy`, `Models.Policy.latestVersion`. Produces `GET /api/policies?record=<id> -> {owner, heir}`, `POST /api/policies` (tide-realm-admin), store `data/heirloom/policies.json` keyed by policy id (`owner:mai-care`, ...), `readPolicies()` / `writePolicy(id, entry)` in `policyStore.ts`.
- [ ] Step 1: `policyStore.ts`: `readPolicies(): Record<string, PolicyEntry>`, `writePolicy(id, entry)`; path `data/heirloom/policies.json`, `mkdirSync` recursive.
- [ ] Step 2: `POST /api/policies`: admin only; body `{policyId, recordId, subject, access, policy}`; decode with `describeRelationshipPolicy` and return 422 unless `isRelationshipPolicy && recordId === body.recordId && subjectId === body.subject.id && subjectType === "Role"`. `GET` requires a token; returns `{owner, heir}` for `?record=`.
- [ ] Step 3: `/setup` page: four buttons, each handler = fetch admin policy -> `signRelationshipPolicy({vendorId, subject:{type:"Role",id}, recordId, access}, adminPolicyBytes)` -> POST. Print `Models.Policy.latestVersion`. Show per-button SIGNED / error with `cause`.
- [ ] Step 4: Run as `notary-duc`: sign all four. Verify `data/heirloom/policies.json` has four keys and `GET /api/policies?record=mai-bank` returns both. **Unknown contract error -> stop, report to team (SPEC section 7 step 6).** Commit.

### Task A5: Phase-7 checks and markers (gate: contract works)
**Files:** `app/src/lib/tide/refusal.ts` (markers); screenshots stay local.
**Interfaces:** Consumes Dev B's `/vault`, `/heir`, `/operator` pages (merged by 13:30; until then use a throwaway page that calls `encryptForRecord`/`decryptForRecord` directly).
- [ ] Step 1: As `mai`: seal `mai-bank` from the fixture, open it -> plaintext. As `long`: open -> refused with `cause` containing `heir-bank-mai`. As `ops`: open -> refused. Encrypt with tags `["mai-bank","x"]` once (throwaway) -> refused.
- [ ] Step 2: Wi-Fi off, `long` opens -> copy `message`; Wi-Fi on. Fill `REFUSAL_MARKER` (a stable substring of the refusal `cause`, e.g. `not found in doken`) and `OUTAGE_MARKER` (a substring present only in the offline error). If identical, leave `OUTAGE_MARKER` empty and the panel never shows grey.
- [ ] Step 3: Local screenshots: login, 401 on plain fetch, refused decrypt. Commit the markers.

### Task A6: Seats, threshold, bootstrap-admin test (one-way door)
**Files:** none in git (local notes and a screenshot of 1 of 2).
- [ ] Step 1: Grant `tide-realm-admin` (client `realm-management`) to `dr-hanh`, approve; then to `thu`, approve; approve each `REGEN_ADMIN_POLICY`.
- [ ] Step 2: As `dr-hanh`: file "grant `heir-bank-mai` to `long`" via the console; approve it -> must read **1 of 2**. Screenshot. Deny it (`thu`). Write `data/heirloom/demo-ids.json` = `{"long": "<keycloak user id>", "heir-bank-mai": "<role id>"}` for Dev B's operator button.
- [ ] Step 3: Bootstrap-admin test per SPEC section 7 step 9; note the outcome locally and tell Dev B. If outcome 3, disable the master `admin` user before recording.
- [ ] Step 4: Verify the gate: login, 401, refused decrypt, 1 of 2 all seen. Push to `main`.

### Task A7 (slice 2, only after 14:30 gate): `/seats` panel
**Files:** Create `app/src/app/seats/page.tsx`, `app/src/app/api/directory/route.ts`.
**Interfaces:** Direct browser calls with the seat's DPoP token: `GET /admin/realms/heirloom/iga/change-requests?status=PENDING`, `POST .../{id}/approve` (`{}` then `{requestModel}` after enclave signing), `POST .../{id}/deny`, `POST /admin/realms/heirloom/users/{id}/role-mappings/realm`.
- [ ] Step 1: Ask the Tide MCP (`tide_canon iga-change-requests-api`, `tide_playbook setup-iga-admin-panel`, `tide_canon` search "requestModel enclave sign") for the SDK call that signs a `requestModel`. **If no documented call exists, stop this task: `/seats` stays the slice-1 page.**
- [ ] Step 2: Build the list (count from `authorizationCount`, fallback `readyToCommit`, never 0), Approve (two-phase), Deny, and "Release bank logins to Long" (role-mapping POST, expect 202).
- [ ] Step 3: Verify beat (c)-(d) fully in-app, then commit and push.

### Task A8: Reset script and rehearsal
**Files:** Create `app/scripts/reset-demo.sh` (deletes `data/heirloom/items.json`, keeps policies; lists pending change requests to deny by hand).
- [ ] Step 1: Write it; add `"reset-demo"` to `package.json` scripts.
- [ ] Step 2: Full rehearsal of section 6; Dev A's local narration follows the real UI strings. Commit.

---

### Track B (Dev B: teammate, UI and data, works against the contract)

### Task B1: Stores, fixtures, `/api/items`, `/api/operator/store`
**Files:** Create `app/src/lib/store.ts`, `app/src/app/api/items/route.ts`, `app/src/app/api/operator/store/route.ts`, `demo/fixtures/heirloom.json`, `app/src/lib/fixtures.ts`; Modify `app/.gitignore` (`data/` already ignored).
**Interfaces:** Produces `readItems(): Item[]`, `appendItem(item: Item): Item` (file `data/heirloom/items.json`); `GET /api/items -> {items}`, `POST /api/items` (role `vault-owner-mai`, 422 rules from Review Focus 3); `GET /api/operator/store` (role `operator`) -> `{files}`; fixture type `{recordId, title, recipientUsername, content}[]`.
- [ ] Step 1: `store.ts` with `readItems`/`appendItem`, `randomUUID` ids, `mkdirSync` recursive.
- [ ] Step 2: Routes with `withRole`. `POST` validates `recordId in ["mai-care","mai-bank"]`, `recipientUsername in ["linh","long"]`, `ciphertext` non-empty string, `title <= 120 chars`; `ownerUsername` = `jwt.preferred_username`.
- [ ] Step 3: `demo/fixtures/heirloom.json`: two items. `mai-care`, "Care wishes" -> `linh`: 6 lines of synthetic care wishes (home care first, no resuscitation if..., who decides, clearly fictional). `mai-bank`, "Bank and pension logins" -> `long`: obviously fake logins (`VietBank demo 0000-1111`, pension id `PEN-DEMO-42`).
- [ ] Step 4: Verify: `curl localhost:3000/api/items` -> 401; `curl localhost:3000/api/health` -> `{"ok":true}`. Commit on `b/ui`.

### Task B2: Refusal panel and status chips
**Files:** Create `app/src/components/RefusalPanel.tsx`, `app/src/components/StatusChip.tsx`, `app/src/components/SyntheticBadge.tsx`, `app/src/app/globals.css` (tokens already there; add component classes only).
**Interfaces:** Consumes `classifyTideError` from `src/lib/tide/refusal.ts` (Task A3; until merged, import a local stub with the same signature). Produces `<RefusalPanel error={unknown} />`, `<StatusChip state="sealed"|"pending"|"released"|"refused" label?/>`, `<SyntheticBadge/>`.
- [ ] Step 1: Use the tokens in `globals.css` (light warm paper, `--refused`, `--pending`, `--approved`); chips = icon + word.
- [ ] Step 2: `RefusalPanel`: red band + "0 of N nodes would release this key" when `nodes` parsed, `cause` in monospace, "Show raw error" toggle; grey band when `kind === "outage"`; a neutral band with raw message when `kind === "unknown"` (Review Focus 2). No retry button.
- [ ] Step 3: Verify by rendering with a fake error `{message:"TIDE-TIDEJS-NET-THRESHOLD_FAILURE: Could not reach enough VVK ORKs (got 0 of 14 required)", cause:"'heir-bank-mai' role not found in doken."}` on a temporary route; screenshot; delete the route. Commit.

### Task B3: `/vault` and `/heir`
**Files:** Create `app/src/app/vault/page.tsx`, `app/src/app/heir/page.tsx`, `app/src/lib/tide/client.ts` (thin wrappers: `getPolicies(record)`, `sealItem(...)`, `openItem(...)` calling `encryptForRecord` / `decryptForRecord` from `relationship.ts`).
**Interfaces:** Consumes `GET/POST /api/items`, `GET /api/policies?record=`, `relationship.ts` (Task A3). Produces the two pages per SPEC section 5.
- [ ] Step 1: `/vault`: list Mai's items; Seal form; "Seal demo items" (reads `fixtures.ts`, seals both with the `owner:*` policy, posts them); "Open" per item with the owner policy.
- [ ] Step 2: `/heir`: items where `recipientUsername === me`; chip Sealed / Released to me (released = my realm roles include `heir-<x>-mai`, from the token); "Open" with the `heir:*` policy -> plaintext or `<RefusalPanel/>` plus the line "Roles arrive on your next sign-in. If a release was just approved, sign out and back in." (Review Focus 1).
- [ ] Step 3: Verify on Dev A's PC (or over LAN): `mai` seals both fixtures; `long` sees two items, opens `mai-bank` -> refusal panel with `heir-bank-mai` in the cause. Commit, merge to `main`.

### Task B4: `/operator` and `/`
**Files:** Create `app/src/app/operator/page.tsx`; Modify `app/src/app/page.tsx`.
**Interfaces:** Consumes `GET /api/operator/store`, `describeRelationshipPolicy`, `decryptForRecord`.
- [ ] Step 1: `/operator`: heading "Everything Heirloom stores"; raw JSON of both files; decoded policies table (`describeRelationshipPolicy`); per item "Try to open" -> `decryptForRecord(ct, recordId, heirPolicy)` with no role check in the page -> `<RefusalPanel/>`; a second button "Call our API without DPoP" using plain `fetch` -> shows "401: the app's own API refused (not Tide)" (Review Focus 5).
- [ ] Step 1b: button "Try to release to Long": `POST {auth-server-url}/admin/realms/heirloom/users/{longId}/role-mappings/realm` body `[{"id":"<role id>","name":"heir-bank-mai"}]` with the operator's own DPoP-bound token via the SDK fetch; `longId` and the role id come from `GET /api/directory`... which is admin-only, so for this button Dev A puts both ids in `data/heirloom/demo-ids.json` at bootstrap (Task A6 step 2) and `/api/operator/store` returns them. Expected on screen: "403 from TideCloak: not a seat" (any 2xx here is a bug to report immediately).
- [ ] Step 2: `/`: sign-in, username, realm roles, links by role, `<SyntheticBadge/>`, "Sign out".
- [ ] Step 3: Verify beat (a) on Dev A's PC: `ops` -> refusal with `0 of N`. Commit, merge.

### Task B5: Polish and README (after 14:30 gate)
**Files:** `README.md`, `app/src/app/heir/page.tsx` (split-screen "What changes" view), optional `mai-letter` item.
- [ ] Step 1: README: starts with `## Project overview` answering the 5 prompts (Vision & originality, Trust-constraint insight, Value & impact, Why TideCloak matters, Prototype & storytelling) in <= 300 words, honest limits from section 1; setup in a separate section with the exact commands (`docker`, `npm run init`, profiles, `/setup`). Dev A runs the word check locally.
- [ ] Step 2: Split-screen view for beat 4; copy pass with the design system's words.
- [ ] Step 3: Hand README to a fresh subagent for a clean-checkout run (`/judge` >= 60). Commit, merge.

---

### Integration checkpoints (both devs, in chat)
- 13:30: Dev B merges B1-B2 to `main`; Dev A pulls; Task A5 uses B3 pages if present.
- 14:00: B3-B4 merged; Dev A runs beats (a)-(b).
- 14:30: beats (a)-(d) on Dev A's PC = **gate**. If missed, run `/stuck`: cut list in SPEC section 8.
- 16:00: code freeze; `main` tagged `demo`.
