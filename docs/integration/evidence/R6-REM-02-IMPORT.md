# R6-REM-02 import — combined automated gate

Kind: INTEGRATION_CHECKPOINT
UTC: 2026-09-15T11:40:00Z
Editor: `@wbdevworld` / WS3
Neutral branch: `batch/r6-first-real-cash-sale`
PR: #55 (draft; REQUEST_CHANGES closed in code; not marked ready; do not merge)

This import does **not** rewrite R6-REM-01. The previous `FRESH_2` on `f6f57cc…` is historical.

## Provenance

```text
reviewed head f6f57cc39b77dd576734a5b8fb5f89be3027c44c
→ authority checkpoint 922720ccbc9e12c535c765c44f1dfea887b19ccc
→ remediation source edafe1e64c869528f57eb8e4bba8b317b33a46c4
→ import (cherry-pick -x) 82a85f4082f461a2709ccfece9a73e4e8872d3d3
```

| Role | SHA |
| --- | --- |
| Base main | `bc606a690f0c167b7057e3ae9143337404275882` |
| Reviewed head | `f6f57cc39b77dd576734a5b8fb5f89be3027c44c` |
| Authority checkpoint | `922720ccbc9e12c535c765c44f1dfea887b19ccc` |
| WS3 source branch | `ws3/r6-rem-02-final-review-security` |
| Tested source | `edafe1e64c869528f57eb8e4bba8b317b33a46c4` |
| Imported (cherry-pick -x) | `82a85f4082f461a2709ccfece9a73e4e8872d3d3` |

Conflicts: none. Untracked root `doc/` was not imported. FE-05 source was not changed. BR-07 source was not changed. Frozen v1 contracts were not changed.

## Review blockers

| Reviewer | Finding | Resolution |
| --- | --- | --- |
| Ben | incomplete transaction tenant/scope isolation | Durable `sale.prepare` row in `pos_pending_operations` binds org/location/register/shift/transaction before existing-sale return or remote Woo resolve. Shared validators in `transaction-scope.ts`. Additive unique index `pos_pending_one_prepare_per_transaction`. |
| Emmanuel 1 | `ok:true` treated as commercial completion | `finalizeSale()` requires `SaleResolution.status === "completed"` before `commercialConfirmed` and receipt. `requires_attention` stays attention. |
| Emmanuel 2 | insufficient cash poisons FE-05 key | Pre-effect validation runs before cash `claimIdempotency`. Corrected amount on the same key proceeds. Effectful changed-body still conflicts. |

No second training commercial sale. Woo order `49439` retained.

## Combined automated gate — PASS

Windows, Node 24.21.0, `supabase.exe` 2.117.0, combined tree `82a85f4…`:

| Check | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `python -m unittest discover -s tests/tooling -v` | PASS, 48 tests |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | PASS, 58 files / 445 tests |
| `pnpm --dir apps/pos-web build` | PASS |
| Playwright e2e `--workers=1` | PASS, 7 tests |
| `git diff --check` | clean |
| `php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --check` | PASS |
| `php tests/bridge/run.php` | PASS, 1297 passed / 0 failed |
| `php tests/bridge/parity.php` | PASS, 138 passed / 0 failed / 19 permission-required/skipped |
| `supabase.exe db reset --yes --local` | PASS, including `20260915120000_pos_prepare_transaction_scope.sql` |
| `supabase.exe test db` | PASS, Files=4, Tests=113 |

`pricingParityVerified` remains false. Issue #4 remains OPEN.

This evidence commit, if applied after `82a85f4…`, produces a later exact head that must have its own green required workflows.

## Limits

Do not mark PR #55 ready. Do not request Ben/Emmanuel from this handoff. Do not merge. Do not start R7.
Production promotion: NOT AUTHORIZED.
No second training commercial sale.
