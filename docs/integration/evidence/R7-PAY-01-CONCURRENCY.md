# R7 PAY-01 concurrent verification floor

Kind: IMPLEMENTATION_EVIDENCE
UTC: 2026-09-16T15:10:00Z
Editor: `@wbdevworld` / WS3
Neutral branch: `batch/r7-electronic-payment-reconciliation`
PR: #58 draft; not review-ready; do not merge

## Authority

Ben checkpoint review (`@Ben-001-sys`) on `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091`: concurrent staff resolve and webhook can both inspect a non-verified payment, call the provider, then persist; `CheckoutStore.withLock()` on the durable adapter is a no-op and `savePayment()` was an unconditional upsert.

## Remediation

SHA: `3ba954b0ad3ff112a93e4af0c87c4a0a0dc2fa12`

- Additive migration `20260916120000_pos_payment_monotonic.sql`: `verified` payments cannot be downgraded; `finalizing`/`completed` sales cannot regress to `payment_pending` or another earlier status, including the `record` JSON status.
- In-memory store, fake PostgREST, and `applyProviderVerification` persist through the same floor. A later pending/failed/timeout write keeps durable `verified`.
- Interleaved tests freeze non-verified snapshots, persist success, then persist weaker results without re-reading.

## Tests (this SHA)

| Check | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `python -m unittest discover -s tests/tooling -v` | 48 OK |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | 60 files / 491 tests PASS |
| `pnpm --dir apps/pos-web build` | PASS |
| Playwright `--workers=1` | 7 passed |
| `php tests/bridge/run.php` | 1297 passed / 0 failed |
| `php tests/bridge/parity.php` | 138 passed / 0 failed / 19 skipped |
| Client `.next/static` | no `sk_test_` / `sk_live_` / `PAYSTACK_SECRET` |
| Push CI | `35113047620` SUCCESS |
| PR CI | `35113054540` SUCCESS |

## Sandbox

```text
PAYMENT PROVIDER SANDBOX GATE: BLOCKED_SANDBOX_CREDENTIALS
```

Declared staging target `https://training.cetechbpa.com` public REST: name includes TRAINING; `url`/`home` = that host, not `cetechbpa.com`. This POS process: `PAYMENT_PROVIDER` unset, secret prefix `UNSET`, no `.env.local`, no `NEXT_PUBLIC_` payment secret. The staging secret was not retrieved, printed, or committed. No Paystack TEST initialize. No Woo order. No live charge.

Milestone FRESH_2 remains withheld until a genuine TEST sandbox PASS.
Production promotion NOT AUTHORIZED.
