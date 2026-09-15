# PAY-01 control-plane remediation — positive Paystack TEST key

Kind: IMPLEMENTATION_EVIDENCE
UTC: 2026-09-15T14:29:21Z
Editor: `@wbdevworld` / WS3
Mode: IMPLEMENT
Task: PAY-01 / #26 control-plane review remediation
Integration issue: #57
PR: #58 remains draft. Do not mark ready. Do not request reviewers.
Contributor branch: `ws3/pay-01-require-sk-test-secret`
Prior neutral head: `dd6c91c27035e0387938d819f880b71b515b338e`

Frozen v1.0.0 contracts were not edited. No refunds. No second training Woo sale. No live payment.

## Finding

`readPaymentProviderConfig()` treated any non-placeholder, non-`sk_live_` secret as `paystack_test` when `PAYSTACK_MODE=test`. The adapter only refused `sk_live_` prefixes. That allowed `pk_test_…`, `pk_live_…`, and arbitrary strings to look like test mode.

## Fix

Ready Paystack test mode requires **all** of:

```text
PAYMENT_PROVIDER=paystack
PAYSTACK_MODE=test
PAYSTACK_SECRET_KEY starts with sk_test_
```

- Explicit live mode, including a TEST key under `PAYSTACK_MODE=live`, is `blocked_live`.
- `sk_live_…` is `blocked_live`.
- `pk_test_…`, `pk_live_…`, `sk_other_…`, and other non-test secrets are `blocked_unsafe`.
- Empty/placeholder remains `disabled` (credentials absent).
- `createPaystackElectronicPaymentProvider()` refuses effectful operations unless the secret starts with `sk_test_`. Unsafe keys make zero HTTP calls: initialize → `live_mode_blocked`, verify → nonretryable `unavailable`, webhook auth → false.

## Source-branch verification

Windows, Node 24.21.0, `supabase.exe` 2.117.0:

| Check | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `python -m unittest discover -s tests/tooling -v` | PASS, 48 tests |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | PASS, 60 files / 489 tests |
| PAY-01 + cash regressions | PASS, 61 tests |
| `pnpm --dir apps/pos-web build` | PASS |
| `pnpm --dir apps/pos-web exec playwright test --workers=1` | PASS, 7 tests |
| `git diff --check` | clean |
| quote-contract `--check` | PASS |
| `php tests/bridge/run.php` | PASS, 1297 passed / 0 failed |
| `php tests/bridge/parity.php` | PASS, 138 passed / 0 failed / 19 skipped |
| `supabase.exe db reset --yes --local` | PASS |
| `supabase.exe test db` | PASS, Files=5, Tests=129 |

Production promotion: NOT AUTHORIZED.
Live electronic payment: NOT AUTHORIZED.
R8: NOT STARTED.
R7: NOT MERGED.
