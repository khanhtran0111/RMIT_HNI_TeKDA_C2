## Project overview

Heirloom lets a person seal what their family will need if they lose capacity or die, with one named recipient per item and only ciphertext stored by the company.

**Vision & originality.** Mai, 68, seals care wishes and bank/pension logins while she can still decide. Long receives only his bank record; the care record remains sealed to other recipients.

**Trust-constraint insight.** Holding every stored byte and signed policy must not confer decryption authority. The intended production design requires two of three independent seats to release an item; neither the company nor a recipient is a seat.

**Value & impact.** Families receive the information intended for them without giving the operator the plaintext. All identities, wishes and account details are synthetic.

**Why TideCloak matters.** The built-in `RelationshipAttestation:1` contract checks the record tag, signed policy and caller’s role at the Tide network. Release grants the record-specific heir role through TideCloak.

**Prototype & storytelling.** The free licence permits three linked accounts: Mai, Long and notary Duc. This demo therefore has one seat, threshold 1; it does not demonstrate a two-seat quorum. Long inspects the server dump but cannot open before release or grant himself access. The notary can release but cannot read. After approval and a new sign-in, Long opens bank logins while care wishes remain refused. Compare his plaintext with stored ciphertext on `/heir`.

**Honest limits:** capacity or death is a human judgement backed by a mocked document; Heirloom cannot make a bank or Apple open an account, it passes on what Mai stored; nothing un-reads what an heir has read; 2 of 3 seats colluding can release early, which is why no seat is the company or a recipient.

## Local setup

Use Node.js 22+ and Chrome or Edge. Allow pop-ups for `http://localhost:3000` and `http://localhost:8080`. Use separate browser profiles for `notary-duc`, `mai` and `long`. Do not use the VS Code browser for Tide sign-in. Browser tests use installed Chrome.

```sh
git clone https://github.com/khanhtran0111/RMIT_HNI_TeKDA_C2
cd RMIT_HNI_TeKDA_C2/app
npm ci
npm run dev
```

The real Tide helper, refusal classifier, `/setup`, `/seats`, policies API and `/check` diagnostics are included. Without Dev A’s private `app/data/tidecloak.json`, the Dev B pages display “Waiting for vault setup”; sign-in and cryptographic operations require that adapter.

### Connect to Dev A’s realm

1. Put the adapter supplied privately at `app/data/tidecloak.json`. It must contain `jwk`, `vendorId`, `homeOrkUrl`, realm `heirloom` and client `heirloom-client`. For LAN testing, Dev A supplies the correct `auth-server-url` and allowed origin.
2. As `notary-duc`, sign the four policies on `/setup`. Use `/check` for record round-trips and refusal diagnostics. The measured refusal/outage markers in `src/lib/tide/refusal.ts` still require Dev A’s verification.
3. On the realm owner’s machine, run `npm run demo-ids` to generate private `data/heirloom/demo-ids.json`. It contains Long’s user ID and the `heir-bank-mai` role ID for the refused release probe.
4. As `mai`, select **Seal demo items** on `/vault`. As `long`, open `/operator`: **Server dump (what Heirloom stores)**. All signed-in users can inspect this ciphertext-only dump.
5. Run the rehearsal below with the real realm. Local UI test doubles do not establish Tide network behavior.

### Bootstrap the recording machine

Dev A owns realm setup. Do not run init against an existing realm as a reset. Requires Docker Desktop, Bash, `curl` and `jq`; on Windows use Git Bash or WSL with Docker integration.

```sh
docker info
cd app
cp .env.example .env
# The deployment owner fills in their password, licence email,
# and TIDE_TERMS_ACCEPTED=yes only after accepting https://tide.org/legal.
REALM_NAME=heirloom CLIENT_NAME=heirloom-client npm run init
npm run dev
```

The init command starts TideCloak and exports the private adapter. Read the **SPEC changed 13:25** amendment in [SPEC](docs/SPEC.md) before applying its original seven-person instructions. The current realm has only `notary-duc` (seat), `mai` (owner), and `long` (heir). There are no `ops`, `linh`, `dr-hanh` or `thu` accounts. The care record’s Linh metadata is a fictional intended recipient, not a linked account; its heir role is not granted. Login branding and onboarding remain “none”.

## Rehearse the three-account demo

1. `mai` seals both fixtures on `/vault` and re-opens them. `long` inspects `/operator`: opening bank logins must show **Refused by the Tide network**, **0 of N nodes would release this key**, and the raw cause. **Try to release to Long** must show **403 from TideCloak: not a seat**. **Call our API without DPoP** must show **401: the app's own API refused (not Tide)**.
2. `notary-duc` opens `/operator` and tries to open either record: refused. Its release-refusal button is disabled because a seat can actually authorize a grant. Use `/seats` and the [TideCloak console](http://localhost:8080/admin/heirloom/console/) for the release procedure.
3. The notary files and approves the `heir-bank-mai` grant to Long with the mocked assessment as a comment. With one admin the threshold is **1**. Skip the original **Pending 1 of 2** beat; two-of-three quorum is an intended production property, unproven by this demo.
4. After commit, Long signs out/in, opens the bank record on `/heir`, and remains refused on care wishes under “Addressed to another recipient”. Use **Compare with stored ciphertext** for the final split-screen. Dev A records the separate bootstrap-admin test outcome and any dev-container exception.

API item metadata and signed policies are visible to authenticated users. Ciphertext and policy possession do not authorize decryption. Policies disclose their role/record metadata, an intentional prototype trade-off. Server validation keeps `mai-care` addressed to Linh and `mai-bank` addressed to Long to match the fixed signed policies.

## Verification

```sh
cd app
npm test
npm run typecheck
npm run build
npm run test:ui
```

Unit/API tests use temporary directories, generated JWT/DPoP keys and synthetic inputs. Browser tests isolate their synthetic identity and crypto doubles from the production build and label the harness explicitly. Real Tide sign-in, decrypt/refusal behavior, measured markers and the bootstrap-admin result still require Dev A’s adapter and realm.

`app/data/`, `.env`, screenshots and local realm state stay out of Git. JSON storage and in-memory DPoP replay protection target one local app process. The intended production two-of-three release requires restoring three independent seat accounts when the licence allows them.
