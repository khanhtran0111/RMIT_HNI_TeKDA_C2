# Work split - Heirloom (22 Oct 2026)

Two devs, one repo, one spec. **Read `docs/SPEC.md` Part 1 once (15 min), then your own track in Part 2.** If something here disagrees with SPEC.md, SPEC.md wins.

| | Dev A - Vinh | Dev B - teammate |
| --- | --- | --- |
| Owns | TideCloak (Docker on Vinh's PC), realm, 7 identities, policies, quorum, `/setup`, `/seats` | All pages users see, the API for items, the refusal UI, fixtures, README |
| Branch | `a/realm` | `b/ui` |
| Machine for the demo | the recording machine | builds on own laptop, tests on Vinh's PC from 13:30 |


> **Change 13:25 (read SPEC "SPEC changed 13:25"):** only 3 Tide accounts exist: `notary-duc` (seat), `mai` (owner), `long` (heir). For you: `/operator` and `/api/operator/store` are open to **any signed-in user** (use `withAuth`), heading "Server dump (what Heirloom stores)"; there is no `linh` or `ops`; the heir page only needs to work for `long`. Everything else in your track is unchanged. App is running on Vinh's PC; `tidecloak.json` will be sent to you in chat.

## Dev B - what you do, in order

**Setup (10 min)**
1. `git clone https://github.com/khanhtran0111/RMIT_HNI_TeKDA_C2 && cd RMIT_HNI_TeKDA_C2 && git checkout -b b/ui`
2. `cd app && npm install`
3. Vinh sends you `tidecloak.json` in chat (never in git). Put it at `app/data/tidecloak.json`, then `npm run dev` -> http://localhost:3000.
4. If Tide login over the LAN does not work within 10 minutes, stop trying. Keep building against the contract in SPEC section 5, and test on Vinh's PC from 13:30.

**Your tasks** (full steps in SPEC Part 2, Track B)
| # | Task | Files you create | Estimate | Done when |
| --- | --- | --- | --- | --- |
| B1 | Stores, fixture loader, `/api/items`, `/api/operator/store` | `src/lib/store.ts`, `src/lib/fixtures.ts`, `src/app/api/items/route.ts`, `src/app/api/operator/store/route.ts` | 25 min | `curl localhost:3000/api/items` -> 401; bad `recordId` -> 422 |
| B2 | Refusal panel + status chips + synthetic badge | `src/components/RefusalPanel.tsx`, `StatusChip.tsx`, `SyntheticBadge.tsx` | 20 min | a fake THRESHOLD_FAILURE error renders red "0 of 14 nodes" + cause |
| B3 | `/vault` (Mai seals and opens) and `/heir` (Linh / Long open or are refused) | `src/app/vault/page.tsx`, `src/app/heir/page.tsx`, `src/lib/tide/client.ts` | 35 min | `mai` seals both items; `long` opens bank logins -> refusal panel |
| B4 | `/operator` ("Everything Heirloom stores", Try to open, Try to release to Long) and `/` | `src/app/operator/page.tsx`, `src/app/page.tsx` | 25 min | `ops`: open -> "0 of N nodes"; release -> "403 from TideCloak: not a seat" |
| B5 | README + split-screen view (after 14:30 only) | `README.md` at repo root | 45 min | overview <= 300 words, 5 prompts, setup section separate |

**Things you get from Dev A (do not build them)**
- `src/lib/tide/relationship.ts` (Tide's helper, copied unchanged) and `src/lib/tide/refusal.ts` with `classifyTideError(err)`. Until Vinh merges them, use a local stub with the **same signature** (SPEC Part 2, Task A3) and delete it after.
- `GET /api/policies?record=mai-bank` -> `{owner, heir}` (signed policies).
- `data/heirloom/demo-ids.json` with Long's user id and the `heir-bank-mai` role id, for the "Try to release to Long" button.

**Rules that will bite you if you skip them**
- The record id is the **only** tag: `encryptForRecord(text, "mai-bank", policy)`. Two tags = refused.
- A `TIDE-TIDEJS-NET-THRESHOLD_FAILURE ... got 0 of N` error **is the refusal**. Show it with its `cause`. Never retry, never call it an outage.
- Call our API with the SDK's DPoP-aware fetch. Plain `fetch` gets 401 (the operator page shows that on purpose).
- Every API route uses `withAuth` / `withRole` from `src/lib/auth/middleware.ts`. Hiding a button is not security.
- Role changes reach a user only after sign out + sign in. Put that hint next to every refusal on `/heir`.
- Use the colors and fonts already in `src/app/globals.css`. Every state = icon + word (SEALED / PENDING / RELEASED / REFUSED). A "SYNTHETIC DATA" badge on every page.
- Use Chrome or Edge, never the VS Code built-in browser (it breaks the Tide sign-in popup). Allow pop-ups for localhost:3000 and localhost:8080.

## Dev A - Vinh, in order (so you know what is coming)
A1 realm template + bootstrap (`npm run init`) -> A2 seven identities and setup roles -> A3 `relationship.ts`, `refusal.ts`, `/api/admin-policy` -> A4 `/setup` + `/api/policies`, sign 4 policies -> A5 contract checks + refusal/outage markers -> A6 add 2 more seats (threshold 2), test "1 of 2", bootstrap-admin test -> A7 `/seats` panel (after 14:30) -> A8 reset script, rehearsal, recording.

## Timeline and check-ins (Vietnam time)
| Time | Dev B | Dev A | Check-in |
| --- | --- | --- | --- |
| 12:50-13:30 | B1, B2 | A1, A2 | 13:30: B merges B1-B2 to `main`; A sends `tidecloak.json` |
| 13:30-14:00 | B3, B4 | A3-A5 | 14:00: B merges B3-B4; A runs beats (a)-(b) |
| 14:00-14:30 | fix what beats (a)-(d) reveal, on Vinh's PC | A6 | **14:30: proof moment runs end to end** |
| 14:30-16:00 | B5 README, polish | A7, A8 | 16:00 code freeze |
| 16:00-17:30 | README final, fresh clean-checkout run | record, encode, push video | 17:30 submit |
A task 1.5x over its estimate stops: say it in chat and pick from the cut list in SPEC section 8.

## Git (both)
- `main` always runs. Work on your branch, commit every 20-30 min.
- Before pushing: `git pull --rebase origin main`, then merge to `main` (fast-forward or a PR with no review). Never force-push `main`.
- You only touch the files you own (SPEC section 9). Shared file: `docs/SPEC.md`, edit only after saying "SPEC changed: section N" in chat.
- Never commit `.env`, `app/data/`, `tidecloak.json`, screenshots. `git status` before every push. The `.gitignore` is a whitelist: if a new file does not show up in `git status`, it is not meant to go to GitHub; ask before forcing it.
