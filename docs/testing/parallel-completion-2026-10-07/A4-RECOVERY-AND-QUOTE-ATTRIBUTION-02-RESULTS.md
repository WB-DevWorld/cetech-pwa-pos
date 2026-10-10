# A4-RECOVERY-AND-QUOTE-ATTRIBUTION-02 — consolidated results

Acting: `@wbdevworld` / WS3 (Cursor)  
UTC publish: `2026-10-10T03:05Z`  
Staff-documentation impact: **NONE**  
Production effects: **NONE**  
Verdict: **NOT READY FOR PRODUCTION**

## Published evidence SHA and frozen identities

| Item | Value |
| --- | --- |
| Published evidence tip (PR #144) | `8d8fe1010f18252af48b14af4a6eed3b4802b237` |
| Prior local tip `6f184d9…` | **superseded locally** — private-email push rejected (GH007); recommitted with noreply and pushed as `8d8fe10` (same docs tree; **no force push**) |
| Product / BUILD_ID freeze | `a4f3284c35785dbb0efe3843d38084f12911ac15` — **unchanged** (`git diff` product paths empty vs freeze) |
| Preview | `dpl_FAaW712WnVBZ9Wr7B8MXCurJEeXW` / https://cetech-pos-staging-q2u9baevb-wbdevworlds-projects.vercel.app |
| Bridge / FPM / migrations | frozen accepted priors — **not** reopened |
| GitHub | PR #144 `headRefOid` = `8d8fe10…`; results file present on branch |

## Software checks now supported by published captures

| Check | Result |
| --- | --- |
| T-D3b draft persistence | **PASS** (software) — retained sample identities in checklist/results |
| T-D4c receipt reload 50317 / `rcpt-33326bbc` | **PASS** (software) |
| T-D4d native print dialog | **PASS** (software only) |
| Journal unresolved recovery | **NOT EXERCISED** |
| Device/PWA/scanner/paper | **TESTER-OWNED PENDING** |

## Lane 1 — backup / recovery

| Item | Result |
| --- | --- |
| Pooler | `aws-1-eu-west-1.pooler.supabase.com:6543` · user `postgres.iegxncvpsyaitkpzywcr` · db `postgres` · **transaction** mode · password **not** provided by API |
| Existing Direct URI / private file | **absent** |
| `cli/login-role` | **NOT ISSUED** — write-provisioning Beta; requires explicit GO |
| Artifact / isolated restore | **NOT RUN** |
| Decision prepared | `A4-RECOVERY-QUOTE-ATTRIBUTION-02-DECISION-LOGIN.md` |
| Gate | **OPEN / BLOCKED** on authorized read-only login + coherent dump + Supabase-compatible restore |

## Lane 2 — quote / REST attribution (isolated)

| Item | Result |
| --- | --- |
| Isolation | reconfirmed NO_DNS / local URL / cron disabled |
| Timed `profile eval` | **BLOCKED** — WP-CLI load already has `rest_api_init` did=1, server present, **88** callbacks |
| Inventory | **88** callbacks; **79** at priority 10; Woo 24 / WP Rocket 10 / Rank Math 10 / WoodMart theme 3 / bridge 1 |
| Dominant named cost | **UNALLOCATED** (no exclusive times) |
| Hypothesis | shared priority-10 REST registration tax; bridge not plurality — see `LANE2-REST-CALLBACK-ATTRIBUTION-A4F3284.md` |
| #132 / live FPM | **OPEN** |

## Lane 3 — commercial decision

| Item | Result |
| --- | --- |
| Sheet | `LANE3-COMMERCIAL-DECISION-A4F3284-CLOSED.md` |
| Choice for senior | **A Cash GO ≤GHS29** / **B TEST** (after capability) / **C 49663 with waiver** / **D DEFER** |
| Execution under this task | **NONE** |

## Hardware / PWA / scanner / paper

Unchanged tester acceptance pending on checklist §A–C.

## References

- Login decision: `A4-RECOVERY-QUOTE-ATTRIBUTION-02-DECISION-LOGIN.md`
- REST attribution: `LANE2-REST-CALLBACK-ATTRIBUTION-A4F3284.md`
- Commercial: `LANE3-COMMERCIAL-DECISION-A4F3284-CLOSED.md`
- Prior remaining-qual results: `A4-REMAINING-QUALIFICATION-01-RESULTS.md` (published at `8d8fe10`)
