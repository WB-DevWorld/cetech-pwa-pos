# R6-REM-02 source — final review security/correctness

Kind: IMPLEMENTATION_EVIDENCE
UTC: 2026-09-15T11:35:00Z
Editor: `@wbdevworld` / WS3
Remediation branch: `ws3/r6-rem-02-final-review-security`
Authority checkpoint (parent): `922720ccbc9e12c535c765c44f1dfea887b19ccc`
Reviewed head: `f6f57cc39b77dd576734a5b8fb5f89be3027c44c`
PR: #55 (draft; not review-ready; do not merge)

This record does **not** rewrite R6-REM-01. FE-05 and BR-07 source were not edited. Frozen v1 contracts were not edited. No second training commercial sale was performed. Woo order `49439` remains historical evidence.

## Ben — durable transaction scope

Trusted local scope is `pos_pending_operations` (`sale.prepare` row) plus the existing `pos_checkout_sales` record. No second scope table.

Shared validators: `apps/pos-web/src/server/sales/transaction-scope.ts`

- Existing prepared sale is returned only after org, location, register, shift, device, and transaction match.
- Remote `salesPort.resolve` runs only after a durable `sale.prepare` binding exists and matches the actor.
- No binding → `NOT_FOUND`, no Woo call.
- Binding/sale mismatch → `FORBIDDEN`, no Woo call.

Additive unique index `pos_pending_one_prepare_per_transaction` on `transaction_id` where `operation = 'sale.prepare'`. Organization + operation + idempotency-key uniqueness is unchanged.

Lost-response recovery is preserved: claim binds the transaction before the bridge call; if the HTTP response is lost, the same scoped staff may resolve the existing Woo order and persist `PreparedSale` without a second prepare.

## Emmanuel 1 — only `completed` confirms commerce

`finalizeSale()` sets `commercialConfirmed = true` and writes a completed receipt only when:

```text
commercial.ok === true
AND isSaleResolution(commercial.data)
AND commercial.data.status === "completed"
```

`ok: true` plus `status: "requires_attention"` (or any other non-completed status) stays attention: `commercialConfirmed = false`, no completed receipt.

## Emmanuel 2 — pre-effect cash does not consume the FE-05 key

`validateCashBeforeEffect()` runs before `claimIdempotency` unless a payment or cash_sale movement already exists. Insufficient amount, wrong currency, and invalid sale state therefore never create a durable `payment.cash` command. Corrected amount on the same FE-05 key may proceed. After an effect exists, same key / changed body remains `IDEMPOTENCY_CONFLICT`.

## Source-branch verification (this tree, before import)

Windows, Node 24.21.0, `supabase.exe` 2.117.0:

| Check | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `python -m unittest discover -s tests/tooling -v` | PASS, 48 tests |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | PASS, 58 files / 445 tests |
| `pnpm --dir apps/pos-web build` | PASS |
| `pnpm --dir apps/pos-web exec playwright test --workers=1` | PASS, 7 tests (3-worker first-load goto flake on this host; serial run green) |
| `git diff --check` | clean |
| `php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --check` | PASS |
| `php tests/bridge/run.php` | PASS, 1297 passed / 0 failed |
| `php tests/bridge/parity.php` | PASS, 138 passed / 0 failed / 19 permission-required/skipped |
| `supabase.exe db reset --yes --local` | PASS, including `20260915120000_pos_prepare_transaction_scope.sql` |
| `supabase.exe test db` | PASS, Files=4, Tests=113 (`prepare_scope_binding.sql` included) |

No second training commercial sale. Production promotion is not authorized.
