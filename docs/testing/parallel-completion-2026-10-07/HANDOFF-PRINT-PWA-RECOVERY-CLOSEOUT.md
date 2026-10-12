# Handoff — Reprint review / qualification closeout (2026-10-09)

```text
Kind: BATCH_COMPLETION after CETECH-POS-Reprint-Review-and-Qualification-Closeout.md
Workstream: WS3 @wbdevworld · bridge review WS2 @Emmanuel-coder-prog (requested; reviews empty)
Branch: ws3/combined-candidate-2026-10-08 · PR #144
Selected base: 7d5778fe904792360947d88122050e529587aa51
Product commit (frozen composition): 542d3ef2f862394a762de43eacf00c724b17aaec
Prior tip before this freeze: e0c5bcf4dca4970803afc94f7a35cdb7ef5597f2
Freeze head: 2e6d704228a522f1f5728c5f2d70cfb08c90e393 — re-verify at read
Contracts/migrations/ADRs: none
Staff-documentation impact: NONE
Production: NOT READY · no alias move · A+D consumed · RD-01 not re-applied · no silent f0
```

## Distinct facts (do not collapse)

| Fact class | State |
| --- | --- |
| Product-source acceptance | Root **ACCEPT** of composition at `542d3ef…` |
| Human GitHub review | **Empty** on #144 — technical ACCEPT ≠ APPROVED |
| Runtime integration proof (local) | **PASSED** — real Orders composition Playwright + unit reprint |
| Corrected Preview runtime | **NOT RUN** — ordinary Exact SHA Preview blocked on inherited Preview Secret `APP_ORIGIN` |
| f0 Preview | Retained `dpl_4Vk3XQ…` / `f0feb44…` for its recorded open-shift / draft checks |
| Bridge install | COMPLETE live hashes retained |
| A+D | CLOSED / cap consumed — txn `33326bbc…` / sale-50317 / Woo 50317 / `rcpt-33326bbc` |
| Local Woo restore | **PASSED** on named target `cetech-pos-r10-woo-20261009` |
| POS staging dump | **BLOCKED** — missing dump credentials/CLI token; named empty PG target exists |
| Installed PWA / hardware | **NOT RUN** — no cashier device this session |
| Native FPM cutover | **UNVERIFIED** (historical); idle signed-off ≠ generation proof |
| B/C | Prep filled with projection maps; **execution unauthorized** |

## Usable behavior (plain English)

Cashiers on a build that includes the history Reprint composition can reprint a completed Orders receipt without an open shift or selected register, without inventing checkout. That is proven in local composition tests. It is **not** yet proven on a corrected immutable Preview because Preview still inherits a fixed `APP_ORIGIN` Secret that rejects new Preview hostnames. Shared tester and f0 stay where they are. Training Woo order 50317 and stock for 49111/49663 were freshly dumped and restored into a disposable local MariaDB. POS staging rows for the same sale were **not** dumped (credential gap).

## Remaining production blockers

Independent exact-head review; origin-safe Preview (owner exception or separately authorized tooling); no-scope Reprint qualification on that Preview; installed standalone PWA + physical print/scan; credentialed POS dump into `cetech-pos-r10-pg-20261009`; native FPM generation evidence if still required; authorized B/C GO; #115/#132; NOT READY FOR PRODUCTION.

## Matrix

| Check | Result | Evidence |
| --- | --- | --- |
| Product composition ACCEPT | **PASSED** (root review) | closeout packet |
| Orders composition Playwright (neg + corrected) | **PASSED** | IMPACT-PRINT-HISTORY-REPRINT-INTEGRATION.md |
| Vitest reprint | **PASSED** (7) | same |
| Exact SHA Preview ordinary path | **BLOCKED** | PREVIEW-DECISION-HISTORY-REPRINT.md — Preview Secret `APP_ORIGIN` + payload BUILD_ID-only |
| Independent APPROVED review | **MISSING** | `gh` reviews `[]` |
| CI @ `e0c5bcf…` | **SUCCESS** | control-plane + windows |
| Woo capture + local restore | **PASSED** | LANE3-RESTORE-CAPTURE-01.md |
| POS staging dump | **BLOCKED** | same — no access-token / DB URL |
| Projection maps 49111 / 49663 | **FILLED** | LANE3-BC-PREP-PROJECTIONS-01.md |
| Installed PWA / hardware | **NOT RUN** | LANE2-PWA-DEVICE-01.md retained |
| FPM cutover identity | **UNVERIFIED** | LANE3-RECOVERY-BC-PREP-01.md |
| B / C execution | **NOT RUN** | decision-only |

## Preview decision (operator)

Do **not** dispatch Exact SHA Preview until an owner grants empty `APP_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN` per-deployment overrides (or authorized protected-main change). Keep f0. Do not move alias. Require non-author APPROVED + CI green on freeze head. Details: `PREVIEW-DECISION-HISTORY-REPRINT.md`.

## Next exact actions

1. Independent exact-head review of freeze tip on #144.
2. Owner origin exception (one request) → deploy → no-scope Reprint qualify 50317 on new Preview.
3. Supply Supabase dump credentials/CLI to operator environment → POS dump into `cetech-pos-r10-pg-20261009`.
4. Cashier-device installed PWA + hardware when available.
5. New senior GO for B and/or C after runtime/TEST keys/reservations revalidated.
