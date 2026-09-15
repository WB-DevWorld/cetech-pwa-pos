# PAY-01 source — verified electronic payment and reconciliation

Kind: IMPLEMENTATION_EVIDENCE
UTC: 2026-09-15T13:18:43Z
Editor: `@wbdevworld` / WS3
Mode: IMPLEMENT
Task: PAY-01 / #26
Integration issue: #57
Contributor branch: `ws3/pay-01-implement-verified-electronic-payment-and-rec`
R7_ACTIVATION_SHA: `0c34694882e69282b9e3df66104197394c55294e`
Post-R6 `main`: `bd79c2901ce33c3177141d4244cc196be0a719d2`
Contract version: v1.0.0
ADRs: ADR-012, ADR-014
PR: not opened. Do not merge. Do not start R8.

Frozen v1.0.0 contracts were not edited. Generated contract TS was not edited. No refunds. No second training Woo sale. Woo order `49439` remains historical R6 evidence.

## START_FRESHNESS_SNAPSHOT

UTC: 2026-09-15T13:18:43Z
origin/main SHA: `bd79c2901ce33c3177141d4244cc196be0a719d2`
Declared R7 activation baseline: `0c34694882e69282b9e3df66104197394c55294e`
PAY-01 issue/version: #26 / frozen contracts v1.0.0
Queue authorizer: CURRENT-WORK R7 activation on the neutral branch

## Architecture

Canonical POS payment state stays provider-neutral. Provider-specific HTTP, channels, HMAC, and transaction envelopes stay behind `ElectronicPaymentProvider`.

- `apps/pos-web/src/server/payments/provider.ts` — port
- `apps/pos-web/src/server/payments/paystack-provider.ts` — Paystack test-mode adapter
- `apps/pos-web/src/server/payments/fake-provider.ts` — deterministic CI double
- `apps/pos-web/src/server/payments/compose-payment-provider.ts` — env composition

Configuration (server-only):

```text
PAYMENT_PROVIDER=paystack
PAYSTACK_MODE=test
PAYSTACK_SECRET_KEY=<server secret>
PAYSTACK_TEST_PAYER_EMAIL=<SANDBOX_FIXTURE_ONLY>
```

Never `NEXT_PUBLIC_PAYSTACK_SECRET_KEY`. Live mode or `sk_live_` fail closed before initialize. Production refuses the sandbox payer fixture.

## Durable state

Additive migration `supabase/migrations/20260915180000_pos_electronic_payment.sql`:

- widen `pos_checkout_payments` for electronic intents (nullable cash/evidence/verified/source until verified)
- unique `(provider, provider_reference)` where reference is present
- unique verified payment per transaction
- `pos_provider_payment_events` journal with unique `(provider, event_fingerprint)`
- RLS revoke anon/authenticated; service_role write

One payment row remains one intent per transaction. Provider reference is `pos_` + payment UUID without dashes, persisted before the remote initialize call.

## Initialize / resolve / webhook

`PaymentPort.initialize` uses only `transactionId` + `tender`. Amount and currency come from the prepared sale. Same idempotency key + body replays; changed body after an effect is `IDEMPOTENCY_CONFLICT`. Lost initialize response keeps the original reference and returns reconciling. Pending never creates a second reference.

Webhook `POST /api/pos/v1/payments/providers/paystack/webhook` authenticates HMAC-SHA512 of the **raw** body (`x-paystack-signature`), constant-time compare. Duplicate deliveries collapse. Unknown references are ingested as ignored diagnostics and do not call provider verify. Browser `/payments/callback` only returns `payment is being checked`.

Verified evidence is created only after provider server verification binds reference, amount, currency, sale/transaction, and test domain. `verificationSource = provider_server_verification`. FinalizeSale remains the commercial authority. Electronic receipts omit `cashReceived` / `changeDue`.

## Source-branch verification (this tree, before freshness Pass 1/2)

Windows, Node 24.21.0, `supabase.exe` 2.117.0:

| Check | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `python -m unittest discover -s tests/tooling -v` | PASS, 48 tests |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | PASS, 60 files / 482 tests |
| PAY-01 + cash regressions | PASS, 54 tests |
| `pnpm --dir apps/pos-web build` | PASS |
| `pnpm --dir apps/pos-web exec playwright test --workers=1` | PASS, 7 tests |
| `git diff --check` | clean |
| `php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --check` | PASS |
| `php tests/bridge/run.php` | PASS, 1297 passed / 0 failed |
| `php tests/bridge/parity.php` | PASS, 138 passed / 0 failed / 19 permission-required/skipped |
| `supabase.exe db reset --yes --local` | PASS, including `20260915180000_pos_electronic_payment.sql` |
| `supabase.exe test db` | PASS, Files=5, Tests=129 (`electronic_payment.sql` included) |

Sandbox provider evidence is a separate gate. Automated CI uses the fake provider only.

Production promotion: NOT AUTHORIZED.
Live electronic payment: NOT AUTHORIZED.
R8: NOT STARTED.
R7: NOT MERGED.
