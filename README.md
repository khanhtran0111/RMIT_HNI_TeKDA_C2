## Project overview

Heirloom lets a person seal what their family will need if they lose capacity or die, so that no company, no single relative and no single seat can open or release it alone, and each item reaches only the person it was meant for.

**Vision & originality.** Mai, 68, chooses while she can: care wishes for her daughter Linh, bank and pension logins for her son Long. Each item has a named recipient.

**Trust-constraint insight.** Holding the database must not confer authority. The operator stores ciphertext and signed policies; the doctor, notary and chosen friend hold three independent seats. Two seats must approve a release. Neither the company nor a recipient is a seat.

**Value & impact.** Families receive what was intended for them without giving one company or relative unilateral access. The prototype uses fictional people and synthetic records.

**Why TideCloak matters.** The built-in `RelationshipAttestation:1` contract checks the record tag, signed policy and caller’s role at the Tide network. A governed role grant needs two approvals; the server cannot decrypt an item or approve a release.

**Prototype & storytelling.** Mai seals two records. The operator’s open fails; its role grant receives 403. Long’s open fails before release. One seat stalls at 1 of 2; a second approves. After signing in again, Long opens his bank record and remains refused on Linh’s care wishes. Compare his plaintext with the stored ciphertext on `/heir`.

**Honest limits:** capacity or death is a human judgement backed by a mocked document; Heirloom cannot make a bank or Apple open an account, it passes on what Mai stored; nothing un-reads what an heir has read; 2 of 3 seats colluding can release early, which is why no seat is the company or a recipient.

## Local setup

Use Node.js 22+ and Chrome or Edge. Allow pop-ups for `http://localhost:3000` and `http://localhost:8080`. Use a separate browser profile for each identity. Never use the VS Code browser for Tide sign-in.

```sh
git clone https://github.com/khanhtran0111/RMIT_HNI_TeKDA_C2
cd RMIT_HNI_TeKDA_C2/app
npm ci
npm run dev
```

Without Dev A’s private `app/data/tidecloak.json`, the app runs with a visible “Waiting for vault setup” state. Encryption and sign-in are unavailable; no mock authentication or fake encryption is used.

### Dev B: connect to Dev A’s realm

1. Put the adapter Dev A supplies privately at `app/data/tidecloak.json`. It must contain `jwk`, `vendorId`, `homeOrkUrl`, realm `heirloom` and client `heirloom-client`. For LAN testing, Dev A supplies the correct `auth-server-url` and allowed origin.
2. Integrate Dev A’s `src/lib/tide/relationship.ts`, `refusal.ts`, `/api/policies`, `/setup`, `/seats` and policy store. The `@/tide-integration/*` alias selects Dev A’s files when present; until then its fallbacks refuse crypto operations and never guess an outage marker. Restart the server after adding the files. Remove `src/lib/integration/` and the second alias target once integration is verified.
3. Dev A signs the four policies on `/setup` and supplies `data/heirloom/demo-ids.json` containing `{"long":"<user id>","heir-bank-mai":"<role id>"}`. The operator route returns only those identifiers alongside the two stored files.
4. Sign in as `mai`, open `/vault`, and select **Seal demo items**. Sign in as `ops`, open `/operator`, and test **Try to open**, **Try to release to Long**, and **Call our API without DPoP**.
5. Run the release rehearsal below on Dev A’s machine. Do not treat local test doubles as Tide network evidence.

### Dev A: bootstrap the recording machine

Dev A owns realm setup. Do not run this against an existing realm as a reset. Requires Docker Desktop, Bash, `curl` and `jq`; on Windows run the shell commands in Git Bash or WSL with Docker integration.

```sh
docker info
cd app
cp .env.example .env
# The deployment owner fills in their password, licence email,
# and TIDE_TERMS_ACCEPTED=yes only after accepting https://tide.org/legal.
REALM_NAME=heirloom CLIENT_NAME=heirloom-client npm run init
npm run dev
```

The init command starts the TideCloak Docker container and exports the private adapter. Dev A must first apply Track A’s realm-template/admin-name changes; this branch implements Track B. Follow [SPEC bootstrap order](docs/SPEC.md#7-bootstrap-order-dev-a-one-way-doors-marked) for registration, role assignment, policy signing, refusal/outage measurements, the extra seats and the master-admin test. Login branding and onboarding are “none” per the plan.

Profiles: A-1 `notary-duc`, A-2 `dr-hanh`, A-3 `thu`; B-1 `mai`, B-2 `linh`, B-3 `long`, B-4 `ops`. Only the first three receive the `realm-management` client role `tide-realm-admin`. Grant the doctor’s and friend’s admin roles last, after signing the policies and checking refusals.

## Rehearse the proof

1. `mai` seals both fixtures on `/vault` and opens them. `ops` sees the raw ciphertext/policies on `/operator`; opening bank logins must show **Refused by the Tide network**, **0 of N nodes would release this key** and the raw cause. Its release probe must show **403 from TideCloak: not a seat**. The plain fetch probe must show **401: the app's own API refused (not Tide)**.
2. `long` opens `/heir`; opening bank logins is refused. `dr-hanh` files the `heir-bank-mai` grant to Long and approves it in the [TideCloak console](http://localhost:8080/admin/heirloom/console/). It must remain **Pending 1 of 2**. Long signs out/in and is still refused.
3. `notary-duc` approves the same request, with the mocked assessment as a comment. Once committed, Long signs out/in, opens the bank record and remains refused on care wishes in “Addressed to another recipient”. Use **Compare with stored ciphertext** for the final split-screen.
4. Dev A records whether Linh’s care item was released separately or stays sealed, and the bootstrap-admin test outcome. If the master admin bypasses quorum, disable that account before recording or document the dev-container exception.

The API deliberately returns ciphertext for every item to authenticated callers. The other-recipient section demonstrates that visible ciphertext and possession of the signed heir policy do not grant decryption. Signed policies disclose their role/record metadata, an intentional prototype trade-off.

## Verification

```sh
cd app
npm test
npm run typecheck
npm run build
npm run test:ui
```

Unit/integration tests use temporary directories, generated signing keys and synthetic inputs. UI tests clearly isolate their test doubles from the production build. The unauthenticated production app remains usable before realm setup.

The Dev B handoff still needs Dev A’s adapter, helper/classifier, signed policies, demo identifiers and real proof beats (a)–(d). Actual Tide login, network refusal markers, quorum behavior and the bootstrap-admin outcome cannot be established without them.

`app/data/`, `.env`, screenshots and local realm state stay out of Git. JSON storage and in-memory DPoP replay protection target one local app process; run the demo with that architecture.
