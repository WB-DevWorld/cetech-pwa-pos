# R7 PAY-01 Paystack TEST sandbox

Kind: IMPLEMENTATION_EVIDENCE
UTC: 2026-09-16T16:33:20Z
Editor: `@wbdevworld` / WS3
Mode: INTEGRATE
Task: PAY-01 / #26
Integration issue: #57
Neutral branch: `batch/r7-electronic-payment-reconciliation`
PR: #58 draft; do not merge; do not mark ready
Code head used: `e589b7d97303a05d5e5fd353de5e40d124fc2483`
CONCURRENCY_REMEDIATION_SHA: `3ba954b0ad3ff112a93e4af0c87c4a0a0dc2fa12`
Contract version: v1.0.0
Pass 3: NOT PERMITTED

Production promotion: NOT AUTHORIZED
Live Paystack: NOT AUTHORIZED
R8 / RT-01: NOT STARTED / NOT IMPORTED

## Configuration classification (no secret values)

Paystack TEST was loaded by the Next.js POS BFF from the existing gitignored file
`apps/pos-web/.env.local` in the sibling checkout `cetech-pwa-pos` (not copied, not moved,
not committed). Runtime composition used R7 code at `e589b7d` with `APP_ENV=staging`.

```text
PAYMENT_PROVIDER: SET
PAYMENT_PROVIDER_IS_PAYSTACK: YES
PAYSTACK_MODE: SET
PAYSTACK_MODE_IS_TEST: YES
PAYSTACK_SECRET_PRESENT: YES
PAYSTACK_SECRET_CLASS: sk_test_
PAYSTACK_TEST_PAYER_EMAIL: SET
NEXT_PUBLIC_PAYSTACK_SECRET_PRESENT: NO
COMPOSED_KIND: paystack_test
```

Unsigned webhook POST to the running BFF returned HTTP 401 (provider configured), not 503.
Staging commerce host `https://training.cetechbpa.com` (`cetechtrainingappserver`,
`wp_get_environment_type=staging`). Production `cetechbpa.com` was not used.
The secret was never printed, logged, or committed.

## Successful TEST electronic tender

| Field | Value |
| --- | --- |
| Quote | `q55e14e7547dfca6da714f575eebd3ab2` total **GHS 29.00** (`minor` 2900) |
| POS transaction | `8a9959df-4f82-4a25-9792-b058886ed69a` |
| Woo order | **49449** (`sale-49449`) |
| Paystack TEST reference | `pos_2f0b5a038deb47c68aa36a7b9551b098` |
| Payment id | `2f0b5a03-8deb-47c6-8aa3-6a7b9551b098` |
| Tender | `card` |
| Provider TEST UI | Success path; amount GHS 29 |
| Server verify | `verified` / `provider_server_verification` |
| Amount / currency | 2900 / **GHS** (quote, durable payment, Woo total) |
| Binding | Woo `_cetech_pos_transaction_id` and `_cetech_pos_payment_id` match |
| Woo after finalize | `processing`, **PAID=YES**, total 29.00 GHS |
| POS sale | `completed` |
| Receipt | `rcpt-8a9959df` |
| Durable payment rows | **1** |
| SKU `49111` `_stock` | **4** (one unit from this sale) |

Browser/provider redirect was not treated as payment truth (`GET /payments/callback` returned
`payment is being checked` only). Finalize used server verification.

## Exact-once

- Prepare replay (same key+body): same `sale-49449`
- Initialize replay (same key+body): same payment id
- New initialize key while intent existed: same payment id (no second charge)
- Paystack `/charge` with the same reference: HTTP 400 `duplicate_reference` (no second payment)
- After complete, new initialize: `VALIDATION_ERROR`
- Finalize replay: still `completed`
- Receipt replay: same `rcpt-8a9959df`
- Woo order 49449 remains the single commercial order for this transaction

## Recovery / arrival order (this sale)

| Case | Result |
| --- | --- |
| Callback is not truth | PASS |
| Webhook then server resolve | `verified` |
| Duplicate `charge.success` webhook | accepted; still one verified payment |
| Stale `charge.failed` webhook after verified | accepted; durable status stayed `verified` |
| Duplicate resolve | stayed `verified` |
| Process restart after complete | GET sale `completed`; GET receipt `rcpt-8a9959df`; no second initialize |
| Abandoned/cancelled verify before TEST success, then later provider success | durable advanced to `verified` (no second initialize) |

## Cases retained as deterministic automated evidence

Real Paystack TEST tooling cannot safely forge amount/currency/binding mismatches or an
in-process stale weaker verify after success on this live reference. Those remain covered by
`tests/integration/payments/electronic-payment.test.ts` and
`tests/integration/payments/durable-electronic-store.test.ts` (54 tests PASS this workstation,
including interleaved concurrency and cash harness).

Cash regression: CORE-06 harness PASS. No second cash Woo sale.

## Limits

- Local Supabase is the POS operational database; training Woo is the commerce host.
- `pricingParityVerified` remains false. Issue #4 remains OPEN.
- Woo `PAYMENT_METHOD` and `EVIDENCE_META` were empty after complete (same class of gap as R6 `EVIDENCE_META`).
- HPOS count observed **55**; this file does not claim an isolated +1 against other training orders.
- VitePOS was not deactivated. Live Paystack was not enabled.
