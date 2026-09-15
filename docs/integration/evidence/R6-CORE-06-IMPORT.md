# R6 CORE-06 import — combined automated gate

Kind: INTEGRATION_CHECKPOINT
UTC: 2026-09-15T02:05:00Z
Editor: `@wbdevworld` / WS3 (INTEGRATE, not CORE-06 contributor)
Neutral branch: `batch/r6-first-real-cash-sale`
PR: #55 (remains draft)

## Import provenance

| Role | SHA |
| --- | --- |
| Pre-CORE06 tested integration base | `ef7660ddca607ca748cb9eb71487b856004d0817` |
| Neutral head before import | `be34728f8e531956999d94c9f3f703a4da0138f9` |
| Contributor implementation | `0162e408d10e22eb9806aa5c5d61ca74a91a2192` |
| Contributor FRESH_2 / handoff | `9e7bae589ccd8df818ded67d59dca37683837204` |
| Imported implementation (cherry-pick) | `212374d8d505c8c45a47563708449bd3be98add2` |
| Imported evidence (cherry-pick, STATUS/HANDOFF reconciled) | `e64b0fa94bddb40ccf2e13b3ffb289a995b49c92` |
| Combined candidate this record describes | `e64b0fa94bddb40ccf2e13b3ffb289a995b49c92` |
| Later scheduler/docs commit | recorded in PR #55 after this file is committed; does not change implementation |

Conflicts: only `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md` and `HANDOFF.md`. Batch scheduler truth was preserved; CORE-06 completion facts were merged in. `CURRENT-WORK.md` was not taken from the contributor branch.

Contracts: unchanged v1.0.0. Migrations: none from CORE-06. FE-05 and BR-07 implementation not rewritten. Untracked root `doc/` not imported.

## Automated combined gate — PASS

Local (Windows, Node 24.21.0):

- `python scripts/verify_control_plane.py` PASS
- `python -m unittest discover -s tests/tooling -v` PASS, 48 tests
- `pnpm install --frozen-lockfile` PASS
- `pnpm --dir apps/pos-web lint` PASS
- `pnpm --dir apps/pos-web typecheck` PASS
- `pnpm --dir apps/pos-web test` PASS, 53 files / 406 tests
- `pnpm --dir apps/pos-web build` PASS
- `pnpm --dir apps/pos-web test:e2e` PASS, 7 tests
- `git diff --check` clean
- `php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --check` PASS (`artifact matches the canonical contract`)
- `php -l` on Makefile check sources PASS, 42 files (`make -C wordpress/cetech-pos-bridge check` BLOCKED on this host: GNU Make recipes use POSIX shell; Windows cmd fails)
- `php tests/bridge/run.php` PASS, **1297 passed / 0 failed**
- `php tests/bridge/parity.php` PASS, **138 passed / 0 failed / 19 permission-required/skipped**; `pricingParityVerified` remains false
- `npx supabase@2.117.0 db reset --yes --local` FAILED (Node 24 `npx.cmd` cmd.exe special-character restriction; known)
- official `supabase.exe` 2.117.0 `db reset --yes --local` PASS after Docker Desktop connected; applied operational, staff-session, catalog-projection, cash-sale uniqueness migrations + seed
- `supabase.exe test db` PASS; Files=2, Tests=88; `cash_sale_uniqueness.sql` ok; `rls_isolation.sql` ok

GitHub Actions on exact head `e64b0fa94bddb40ccf2e13b3ffb289a995b49c92`:

- push run **34919556401**: SUCCESS — `control-plane` (includes Supabase reset + pgTAP + E2E) and `control-plane-windows`
- PR #55 run **34919562334**: SUCCESS — both required jobs

## Isolated staging real-sale gate — BLOCKED

2026-09-15 unauthenticated probe of `https://training.cetechbpa.com/wp-json/cetech-pos/v1/health`:

- HTTP **401**
- JSON envelope `ok:false`, `error.code=AUTH_REQUIRED`, message `Authentication is required for the CETECH POS bridge.`
- This is **not** the 2026-09-12 404 “plugin absent” observation. The route exists.

Still not authorized:

- CP-04 write-safety / cutover remains OPEN (`LIVE-ENVIRONMENT-FACTS.md`, `docs/runbooks/CP-04-REMAINING-WORK.md`, issue #4)
- training isolation vs production writes **NOT PROVEN**
- MailPoet active / `admin_email` domain previously classified **UNSAFE** for write tests (CP04-W1 not closed)
- no repository record authorizing a controlled staging order/stock/tender write
- credentials, if present, are not treated as authorization

No staging Woo order, stock mutation, cash tender, or customer communication was performed.

Instrumented/in-process `woo-1` is **not** a live staging Woo order.

## Classification

```text
CODE / CONTRACT / AUTOMATED COMBINED GATE: PASS
ISOLATED STAGING REAL-SALE GATE: BLOCKED
R6 FINAL ACCEPTANCE: BLOCKED_RUNTIME_EVIDENCE
```

Final ADR-012 FRESH_2 + independent review for R6 acceptance is **not** started. PR #55 remains draft. R7 is not started. Production promotion is not authorized.

## Unblock

Close CP04-W1 (mail/notification containment) and CP04-W2 (write boundary / isolation) with operator evidence, then record explicit authorization for one synthetic training cash-sale rehearsal. Only then may CORE-06 execute the isolated staging vertical.
