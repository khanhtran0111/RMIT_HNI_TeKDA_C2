[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

_Heirloom seals your secrets; after incapacity or death, people you chose release each one to its recipient._

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

Mai, 68, has early dementia. While lucid, she seals care wishes for her daughter Linh and bank logins for her son Long. Release needs 2 of 3 independent seats she chose (notary, doctor, relative). Heirloom can neither read nor release. Mai's vault is only the first door: the same rules can open care wishes for a doctor, a bank power of attorney, or a founder's keys for a board.

### 2. Trust constraint insight

Today one party decides: Apple, a Google timer, or one emergency contact who may take everything unless the owner objects. Mai cannot, and a timer cannot tell dementia from silence. Family, friends, neighbours or caregivers were involved in 55% of news-reported US elder financial abuse cases (MetLife, 2009). Without one decider, Mai can seal now, naming each item's recipient.

### 3. Value & impact

Older adults facing dementia, and the children acting for them. Only 5% of UK over-55s have a digital-inheritance plan (Censuswide, 2026). Once Mai cannot manage money, Long gets her bank logins for care bills; Linh's care wishes stay sealed from him and from Heirloom.

### 4. Why TideCloak matters

With ordinary login, an operator could read or release anything. Mai's browser encrypts contents; opening needs 14 of 20 Tide nodes to agree the caller holds the item's role. TideCloak holds a release until a seat approves in the Tide enclave, outside our app.

### 5. Prototype & storytelling

The server dump shows every stored byte, yet **Try to open** gets "0 of 14 nodes would release this key". Once the notary approves, Long opens the bank logins, not Linh's care wishes. The prototype has one seat (licence limit). [Video](heirloom-demo.mp4).

## Setup

The prototype runs against a local TideCloak (in Docker) and the live Tide network. To click through the story without installing anything, see [Live walkthrough](#live-walkthrough).

### Prerequisites

- **Docker**, running: Docker Desktop on Windows or macOS, Docker Engine on Linux (your user must be able to run `docker` without `sudo`). Ports **8080** (TideCloak) and **3000** (the app) must be free. The init script stops and removes any existing container named `tidecloak`.
- **Node.js 20.9 or newer** with npm (Next.js 16 requires `>=20.9.0`; we used Node 24).
- **Bash with `curl` and `jq`**. The scripts are Bash.
  - Windows: install [Git for Windows](https://git-scm.com/download/win) and run every command below in **Git Bash**, not PowerShell or cmd (there, `bash` can resolve to WSL). Install jq with `winget install jqlang.jq`; the scripts find it in the winget folder on their own. `curl` ships with Git Bash.
  - macOS (not tested): `brew install jq gnu-sed`, then, in the terminal you use for setup, run `export PATH="$(brew --prefix)/opt/gnu-sed/libexec/gnubin:$PATH"`. The init script calls GNU-style `sed -i`, which the built-in macOS `sed` rejects.
  - Linux: `sudo apt install curl jq` (or your distribution's equivalent).
- **Chrome or Edge** with **three browser profiles**, one per account (`notary-duc`, `mai`, `long`). Allow pop-ups for `localhost:3000` and `localhost:8080`. If the browser asks whether the Tide enclave may access apps and services on your local network, click **Allow**: the enclave (on `tideprotocol.com`) has to reach TideCloak on `localhost:8080`. Do not use the VS Code built-in browser for Tide sign-in.
- **An email address you control** for the free Tide licence, and Tide's Terms & Conditions read at https://tide.org/legal.

We ran it on Windows 11 with Git Bash and Docker Desktop.

### 1. Clone and configure

Clone the whole repository: the app reads its demo items from `demo/fixtures/heirloom.json` at the repository root.

```sh
git clone https://github.com/khanhtran0111/RMIT_HNI_TeKDA_C2.git
cd RMIT_HNI_TeKDA_C2/app
cp .env.example .env
```

Edit `app/.env` and set three values:

```sh
KC_BOOTSTRAP_ADMIN_PASSWORD='a-local-password-you-choose'
TIDE_LICENSE_EMAIL=you@your-domain
TIDE_TERMS_ACCEPTED=yes
```

- `KC_BOOTSTRAP_ADMIN_PASSWORD` is the password of TideCloak's local master admin (user `admin`). Keep the single quotes if it contains spaces or symbols such as `$` or `&`: the scripts read this file with Bash.
- `TIDE_LICENSE_EMAIL` licenses the new realm. Placeholder domains (`example.com`, `test.com` and similar) are rejected. The same address becomes the email of the local `notary-duc` user.
- Set `TIDE_TERMS_ACCEPTED=yes` only if you have read and agree to https://tide.org/legal. If the email or the terms value is missing, the script asks for it in the terminal, or stops before creating anything.

### 2. Install and bootstrap TideCloak

From `app/`:

```sh
npm install
REALM_NAME=heirloom CLIENT_NAME=heirloom-client \
  CAST="mai:vault-owner-mai,_tide_encryptor,_tide_decryptor long:_tide_decryptor" \
  npm run init
```

- `REALM_NAME` and `CLIENT_NAME` are required. Without them the script names the realm after `package.json` (`verify-registry`), while `npm run demo-ids` and `npm run reset-demo` look for the realm `heirloom`.
- `CAST` creates the three-account cast: `notary-duc` (always created, as the first admin), `mai` and `long`, with the roles shown. The free Tide licence links at most three accounts. Without `CAST` the script creates a seven-person cast and waits for all seven.

The script pulls and starts TideCloak with this command (you do not need to run it yourself):

```sh
docker run -d --name tidecloak \
  -v "<path to app/data>:/opt/keycloak/data/h2" \
  -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=<from .env> \
  tideorg/tidecloak-dev:latest
```

It waits up to 120 seconds for TideCloak (if it times out, run `docker logs tidecloak`). It then creates the realm and client, licenses the realm, turns on governance (IGA), creates the three users with their roles, and prints one invite link per account.

### 3. Link three Tide accounts

The script prints the links and also saves them to `app/data/invite-links.txt`:

```
A-1  notary-duc  http://localhost:8080/realms/heirloom/login-actions/...
--   mai  http://localhost:8080/realms/heirloom/login-actions/...
--   long  http://localhost:8080/realms/heirloom/login-actions/...
```

Open each link in its own browser profile, `notary-duc` first. In the Tide window, create a Tide account (you choose its username and password) and finish linking. Use a different Tide account for each link. The `notary-duc` link is valid for 12 hours, the others for 4 hours.

The script checks for linked accounts on its own. Once all three are linked, it approves the setup role changes, gives `notary-duc` the `tide-realm-admin` role (this makes the notary the seat), writes `app/data/tidecloak.json` and ends with `Init complete!`. You can ignore the printed notes about branding and new-user details, and the line `Skipping enclave branding`.

- If the terminal closed while waiting, run the same command with `RESUME=1` in front. It continues at the linking step with the same links.
- Do not re-run `npm run init` without `RESUME=1`: it removes the `tidecloak` container, deletes the realm database (`app/data/keycloakdb*`) and `app/data/tidecloak.json`, and starts again from nothing.

### 4. Start the app

```sh
npm run dev
```

Open http://localhost:3000. The app must run on port 3000, because the realm only accepts sign-ins redirected to `http://localhost:3000`. If Next.js reports another port, free port 3000 and start again.

### 5. Sign the four policies (as `notary-duc`)

In the `notary-duc` profile, open http://localhost:3000, click **Sign in with Tide**, then open **Setup** (`/setup`). Click **Sign owner:mai-care**, **Sign owner:mai-bank**, **Sign heir:mai-care** and **Sign heir:mai-bank**, and approve each one in the Tide enclave pop-up. Under "Stored policies", all four should show **STORED**.

### 6. Write the demo ids

In a second Git Bash or terminal window, from `app/`:

```sh
npm run demo-ids
```

This only reads from TideCloak (it needs TideCloak running and `app/.env`). It writes `app/data/heirloom/demo-ids.json` with the user id of `long` and the ids of the heir roles, which the **Try to release to Long** button needs. No restart is needed.

### 7. Mai seals her items (as `mai`)

In the `mai` profile, sign in and open **My vault** (`/vault`). Click **Seal demo items**. Two items appear as SEALED: "Care wishes" for Linh and "Bank and pension logins" for Long. Sealing needs the owner policies from step 5.

Later sessions: start TideCloak with `docker start tidecloak` (its data stays in `app/data`), then run `npm run dev` from `app/`. To run the demo again, `npm run reset-demo` deletes the sealed items (it keeps the policies and the ids) and lists pending change requests without approving any; Mai then seals again.

### Demo accounts

All people and data are synthetic. There are no shared passwords: each account is a Tide account that the person running setup creates while linking in step 3, and Heirloom never sees its password.

| Account | Plays (fictional) | Holds |
| --- | --- | --- |
| `notary-duc` | Notary Duc, the only seat (release threshold 1) | `tide-realm-admin` (client role of `realm-management`) |
| `mai` | Mai, 68, the owner | `vault-owner-mai`, `_tide_encryptor`, `_tide_decryptor` |
| `long` | Long, her son | `_tide_decryptor`; receives `heir-bank-mai` only when a seat releases the bank logins |

Linh, Mai's daughter, has no account: the free licence links at most three.

### Demo video

[`heirloom-demo.mp4`](heirloom-demo.mp4), at the repository root. What it shows: [Demo video](#demo-video).

### First thing to try

Do this before any release. In the `long` profile, open http://localhost:3000/operator (**Server dump**). The page shows every file Heirloom stores: the sealed items and the signed policies.

1. Under "Attempt 1 of 3", on "Bank and pension logins", click **Try to open**. Expected: **Refused by the Tide network**, "0 of 14 nodes would release this key", reason `'heir-bank-mai' role not found in doken.`
2. Under "Attempt 2 of 3", click **Try to release to Long**. Expected: **403 from TideCloak: not a seat**.

Then the release: in the `notary-duc` profile, open **Independent seats** (`/seats`), click **Release bank logins to Long**, then **Approve in the Tide enclave**. TideCloak files a change request instead of granting the role, and commits it only after the enclave approval. Long signs out and back in (new roles arrive at sign-in). On **For me** (`/heir`), the bank logins open, while Linh's care wishes stay refused.

## Demo video

[`heirloom-demo.mp4`](heirloom-demo.mp4) is in this repository and runs about two minutes. It was recorded against a local TideCloak and the live Tide network: the refusals and the enclave approval are real responses, not mock-ups. All people and data are synthetic. It covers four beats:

1. **Possibility.** Mai, 68, seals care wishes for her daughter Linh and bank logins for her son Long, encrypted in her browser.
2. **Constraint.** Today one party decides: a company, a timer, or one relative.
3. **The prototype and TideCloak's role.** The server dump holds every stored byte, yet the Tide network refuses to open the bank logins ("0 of 14 nodes would release this key"). Long's own release attempt gets "403 from TideCloak: not a seat". Notary Duc files the release, and it commits only after he approves it in the Tide enclave, outside our app.
4. **What changes.** After the release, Long opens the bank logins in his browser, while Linh's care wishes stay refused. Then the bigger picture: the same engine for care wishes, power of attorney, founder continuity and self-custody wallets, and a roadmap from this prototype to a Release Rules API.

## Live walkthrough

[heirloom-unlocked.vercel.app](https://heirloom-unlocked.vercel.app) lets anyone click through the story without an account. It runs the real Heirloom pages in your browser with **simulated** Tide and API responses, and every page says so. The steps in the top bar: 1. Mai seals her items, 2. Long searches the server dump, 3. Long tries to open, 4. Notary Duc releases (a browser dialog stands in for the Tide enclave), 5. Long, after the release. **Start over** resets it.

The real prototype needs the local TideCloak (see [Setup](#setup)); the demo video shows the run against TideCloak and the live Tide network. Source: `app/walkthrough/`. To build it, run `node walkthrough/build.mjs` from `app/`, then deploy `app/walkthrough/dist` as static files.

## How it works

- **Records.** Each item is one record (`mai-care`, `mai-bank`). Mai's browser encrypts the contents with the record id as the only tag. The server keeps the contents only as ciphertext, in `app/data/heirloom/items.json` (created at runtime, not committed). The title and recipient stay readable, so the right person can find the item.
- **Policies.** Four policies use Tide's built-in `RelationshipAttestation:1` contract (nothing custom is deployed): `owner:mai-care` and `owner:mai-bank` give role `vault-owner-mai` read-write; `heir:mai-care` gives role `heir-care-mai` read; `heir:mai-bank` gives role `heir-bank-mai` read. A seat signs them once on `/setup`.
- **Opening = a Tide network decrypt.** On this network, 14 of 20 independent Tide nodes must agree that the caller's session holds the role named in the item's policy. Without it the answer is "Refused by the Tide network: 0 of 14 nodes would release this key".
- **Release = one governed role grant.** A seat asks TideCloak to grant `heir-bank-mai` to Long. TideCloak does not grant it: it files a `GRANT_ROLES` change request, which commits only after a seat approves it in the Tide enclave (a signing window on `tideprotocol.com`, outside our app). Long receives the role at his next sign-in. Revocation is not built in this prototype; it would be the same governed request with a delete.

```
Mai's browser   --encrypt(item, tag=mai-bank)-->  ciphertext --> Heirloom server (stores ciphertext + title + recipient)
Anyone          --decrypt(ciphertext, policy)-->  Tide nodes check policy + tag + caller's role
                                                  no role -> "Refused by the Tide network: 0 of 14 nodes would release this key"
Seat's browser  --grant heir-bank-mai to Long-->  TideCloak change request --> enclave approval --> commit
Long (re-login) --decrypt mai-bank-->             role present -> at least 14 of 20 nodes agree -> plaintext in his browser
Long            --decrypt mai-care-->             no heir-care-mai role -> refused
```

## The bigger picture: one engine, many doors

Heirloom is the first app on a bigger idea: **release rules that no company, admin or single relative can override.** Some decisions must open for the right person at the right moment, when the person they belong to can no longer decide. Today one party holds that power. On Tide nobody does: it emerges only when the people you chose agree.

The engine is the same four steps for every use: **seal** it in your own browser, **name** who it opens for and which seats decide, the seats **approve** in the Tide enclave (TideCloak commits it as a governed change), and the Tide network **opens** it only for the named person.

| Door | Opens for | Decided by (2 of 3) |
| --- | --- | --- |
| Digital inheritance (**built today**) | named heirs | notary, family doctor, a relative |
| Advance care wishes | the treating doctor | GP, family, hospital ethics lead |
| Power of attorney | limited spending authority at the bank | doctor, lawyer, family |
| Founder continuity | admin keys, treasury, client files | board members |
| Self-custody crypto | the 12-word recovery phrase | chosen seats; no timer, no custodian |
| Guardianship plan | the children's guardian | named guardians and a lawyer |
| Break-glass medical records | the emergency doctor | on-call clinicians |
| Sealed testimony | a lawyer or editor | trusted peers, not a dead man's switch |

**Why it matters at scale.** 57 million people were living with dementia in 2021, with nearly 10 million new cases a year ([WHO](https://www.who.int/news-room/fact-sheets/detail/dementia)). About $124 trillion is expected to pass between generations in the US alone through 2048 ([Cerulli Associates, 2024](https://www.cerulli.com/press-releases/cerulli-anticipates-124-trillion-in-wealth-will-transfer-through-2048)). Yet only 36.7% of US adults have any advance directive ([Yadav et al., Health Affairs, 2017](https://pure.psu.edu/en/publications/approximately-one-in-three-us-adults-completes-any-type-of-advanc/)).

**Why only Tide makes this credible.** With ordinary login and backend permissions, whoever runs the server, or one admin, can always read or grant: a promise, not a guarantee. With Tide, no one ever holds the whole key, 14 of 20 independent nodes enforce the signed rule, and a release is a governed change that seats approve in the Tide enclave.

**Roadmap.**
- **Now:** this prototype. One family, real Tide network, real enclave approval, one seat (free licence).
- **Next:** a pilot with 2 of 3 independent seats (notaries and family doctors), a capacity-assessment workflow, revoking while the owner is capable, Vietnamese and English.
- **Then:** a Release Rules API and SDK, so banks, hospitals, law firms and wallet providers embed governed release without ever holding a master key.
- **Vision:** no institution needs to be trusted with a family's most private decisions.

### What the full design adds, and what this prototype shows

1. **2 of 3 independent seats**, such as a notary, a family doctor and a relative. The company that runs Heirloom is never a seat. *Here: one seat (Notary Duc, release threshold 1), because the free Tide licence links at most three accounts. The 2-of-3 quorum is not shown.*
2. **The company can neither read nor release.** *Here: the server dump holds every stored byte and the Tide network still refuses to open it; a release attempt from an account that is not a seat gets 403 from TideCloak.*
3. **Each item has its own recipient**, instead of all-or-nothing access: letters for a daughter, a business account for a partner, medical wishes for the doctor. *Here: Long's release opens the bank logins, not Linh's care wishes.*
4. **Loss of capacity, not only death.** Someone with dementia or in a coma cannot object, so a timer fails; seats can decide. *Here: the seat can attach a capacity assessment (synthetic) to the release request.*
5. **Any secret, not only crypto**: letters, passwords, care wishes, a wallet's 12-word recovery phrase. *Here: two text items.*

Crypto tools that split keys already exist (Vault12, Casa, Ledger Recover), but they protect wallets. What Heirloom adds is the combination of these five properties for any secret, not any one of them alone.

## Honest limits

- The prototype has one seat (the notary), so the release threshold is 1: the free Tide licence refused more than three linked accounts. The design is 2 of 3 independent seats; this demo does not show that quorum.
- Capacity or death is a human judgement backed by a document. In the demo the document is mocked: capacity assessment CA-DEMO-07 (synthetic), attached to the release request as a comment.
- Item titles and recipients are stored readable; only the contents are encrypted.
- Nothing un-reads what an heir has read.
- 2 of 3 seats colluding could release early.
- Heirloom cannot make a bank or Apple open an account; it passes on what Mai stored.
- Revoking a release is not built.
- The live walkthrough simulates the Tide and API responses. Only the local setup and the demo video use real ones.

## Demo walkthrough

The whole story, step by step, with the labels the app shows. Each step names the page and the browser profile.

1. **Possibility** (**My vault**, `/vault`, as `mai`): click **Seal demo items**. Two items appear SEALED with a ciphertext preview: "Care wishes" for Linh and "Bank and pension logins" for Long. Mai can open either one to re-read it.
2. **Constraint**: today one party decides: a company, a timer or one relative.
3. **The server dump** (**Server dump**, `/operator`, as `long`): the page "Server dump (what Heirloom stores)" shows the raw items, the policies and their decoded rules.
   - Attempt 1 of 3, **Try to open** on "Bank and pension logins": **Refused by the Tide network**, "0 of 14 nodes would release this key", with the raw cause.
   - Attempt 2 of 3, **Try to release to Long**: **403 from TideCloak: not a seat**.
   - Attempt 3 of 3, **Call our API without DPoP**: **401: the app's own API refused (not Tide)**.
4. **Son refused before release** (**For me**, `/heir`, as `long`): **Open** the bank logins: refused, cause `'heir-bank-mai' role not found in doken.`
5. **A seat cannot read** (**Server dump**, `/operator`, as `notary-duc`): **Try to open** either item: refused.
6. **Release** (**Independent seats**, `/seats`, as `notary-duc`): click **Release bank logins to Long**. TideCloak files a `GRANT_ROLES` change request instead of granting the role. Optionally tick **Attach the capacity assessment** (the synthetic document CA-DEMO-07, added as a comment), then click **Approve in the Tide enclave** and approve in the Tide enclave window. The request moves to "Recently decided" as **APPROVED**.
7. **One item, one recipient** (**For me**, `/heir`, as `long`): sign out and back in (roles arrive at the next sign-in). **Open** the bank logins: "Threshold met: at least 14 of 20 independent nodes agreed", and the plaintext opens in his browser. **Open** the care wishes (under "Addressed to someone else", "For Linh"): refused, cause `'heir-care-mai' role not found in doken.` **Compare with stored ciphertext** shows his plaintext next to the bytes the server holds.

## Synthetic data

All people, accounts and documents are fictional: Mai, Long, Linh and Notary Duc, the care wishes, the bank and pension logins (`VietBank demo account 0000-1111-2222`, `PEN-DEMO-42`) and the capacity assessment CA-DEMO-07. No real bank, health or government system is connected.
