[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

_Heirloom lets a person seal what their family will need if they lose capacity or die: no company, relative or seat can open or release it alone, and each item reaches only its named recipient._

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

Mai, 68, has early dementia. While lucid, she seals care wishes and bank logins, each for one relative. Release needs people she chose (doctor, notary, friend), not a company, a timer or one child.

### 2. Trust constraint insight

Today one party decides: Apple, Google or a vault company reads or releases; password-manager emergency access hands one contact everything. Family is involved in 55% of elder financial abuse (MetLife, 2009), so one heir alone is unsafe. Only 10% of UK adults plan their digital assets. Without a single key-holder, people can seal what matters.

### 3. Value & impact

Older adults facing incapacity, and families. Once Mai cannot manage money, Long gets the pension logins for care bills; her care wishes stay closed to him and to Heirloom.

### 4. Why TideCloak matters

- The company cannot read or release.
- One relative cannot open or release.
- A seat can release but cannot read.
- Each item opens only for its named recipient.

Our server enforces none of this. Tide network nodes check each item's signed policy and the caller's role before decrypting; TideCloak commits a release (a role grant) only after quorum approval by the seats.

### 5. Prototype & storytelling

Watch the server dump: the operator holds every byte and policy, yet every node refuses. The notary then releases the bank logins; Long opens them but is refused on his sister's care wishes. The free licence's user limit gives the prototype one seat; production uses 2 of 3 independent seats.

## Setup

Prerequisites: Docker Desktop (running), Node 20+, Git Bash on Windows (the scripts are Bash and need `curl` and `jq`), and Chrome or Edge with pop-ups allowed for `localhost:3000` and `localhost:8080`. Never use the VS Code browser for Tide sign-in. Use one browser profile per account: `notary-duc`, `mai`, `long`.

1. Copy `app/.env.example` to `app/.env` and set `KC_BOOTSTRAP_ADMIN_PASSWORD` (the local TideCloak master password), `TIDE_LICENSE_EMAIL` (an address you control) and `TIDE_TERMS_ACCEPTED=yes` (only after you have read and agreed to https://tide.org/legal).
2. Install and bootstrap TideCloak (starts the `tideorg/tidecloak-dev` container, creates the realm, exports `app/data/tidecloak.json`):

   ```sh
   cd app
   npm install
   REALM_NAME=heirloom CLIENT_NAME=heirloom-client \
     CAST="mai:vault-owner-mai,_tide_encryptor,_tide_decryptor long:_tide_decryptor" \
     npm run init
   ```

   `CAST` limits the users to the three-account cast (`notary-duc` is always created as the first admin). Without it the script creates the original seven-person cast, which the free licence will not let you link.
3. Open each printed invite link in its own browser profile and link a Tide account (first link = `notary-duc`). The script continues when all are linked.
4. Start the app:

   ```sh
   npm run dev
   ```

5. At `http://localhost:3000`, sign in as `notary-duc` and sign the four policies on `/setup` (one enclave pop-up each).
6. Write the ids used by the operator's release attempt:

   ```sh
   npm run demo-ids
   ```

## How it works

- **Records.** Each item is one record (`mai-care`, `mai-bank`). Mai's browser encrypts it with the record id as its only tag; the server stores only ciphertext in `data/heirloom/items.json`.
- **Policies.** Four policies use Tide's built-in `RelationshipAttestation:1` contract (nothing custom is deployed): `owner:mai-care` and `owner:mai-bank` give role `vault-owner-mai` read-write; `heir:mai-care` gives role `heir-care-mai` read; `heir:mai-bank` gives role `heir-bank-mai` read. A seat signs them once on `/setup`.
- **Release = one governed role grant.** A seat asks TideCloak to grant `heir-bank-mai` to Long. TideCloak turns that into a `GRANT_ROLES` change request that commits only after seat approval in the Tide enclave (a signing window outside our app). Revocation is the same request with a delete.

```
Mai's browser   --encrypt(item, tag=mai-bank)-->  ciphertext  --> Heirloom server (stores bytes only)
Anyone          --decrypt(ciphertext, policy)-->  Tide nodes check policy + tag + caller's role
                                                  no role -> "Refused by the Tide network, 0 of N nodes"
Seat's browser  --grant heir-bank-mai to Long-->  TideCloak change request --> enclave approval --> commit
Long (re-login) --decrypt mai-bank-->             role present -> plaintext
Long            --decrypt mai-care-->             no heir-care-mai role -> refused
```

## Honest limits

- Capacity or death is a human judgement backed by a mocked document; the capacity assessment in the demo is synthetic.
- Heirloom cannot make a bank or Apple open an account; it passes on what Mai stored.
- Nothing un-reads what an heir has read.
- 2 of 3 seats colluding can release early, which is why no seat is the company or a recipient.
- The prototype has one seat (the notary), so the release threshold is 1. The free Tide licence refused more than three linked accounts. Production uses 2 of 3 independent seats; this demo does not show that quorum.

## Demo walkthrough

1. **Possibility** (`/vault`, as `mai`): click **Seal demo items**. Two items appear SEALED with a ciphertext preview: "Care wishes" for Linh and "Bank and pension logins" for Long. Open either one: Mai can re-read her own items.
2. **Constraint**: today one party decides, the company, a timer or one relative.
3. **The server dump** (`/operator`, as `long`): "Server dump (what Heirloom stores)" shows the raw items, the policies and their decoded rules. **Try to open** "Bank and pension logins": **Refused by the Tide network, 0 of N nodes would release this key**, with the raw cause. **Try to release to Long**: **403 from TideCloak: not a seat**. **Call our API without DPoP**: **401: the app's own API refused (not Tide)**.
4. **Son refused before release** (`/heir`, as `long`): **Open** the bank logins: refused, cause `'heir-bank-mai' role not found in doken.`
5. **A seat cannot read** (`/operator`, as `notary-duc`): **Try to open** either item: refused.
6. **Release** (`/seats`, as `notary-duc`): **Release bank logins to Long**, then approve the change request in the Tide enclave pop-up (the page attaches the comment "Capacity assessment CA-DEMO-07 attached (synthetic)"): **APPROVED, committed**.
7. **One item, one recipient** (`/heir`, as `long`): sign out and back in (roles arrive on the next sign-in). Open the bank logins: plaintext. Open the care wishes (listed under "Addressed to another recipient"): refused (`'heir-care-mai' role not found in doken.`). **Compare with stored ciphertext** shows his plaintext next to the bytes the server holds.

## Synthetic data

All people, accounts and documents are fictional: Mai, Long, Linh and Notary Duc, the care wishes, the bank and pension logins (`VietBank demo account 0000-1111-2222`, `PEN-DEMO-42`) and the capacity assessment. No real bank, health or government system is connected.
