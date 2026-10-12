# A4 payments repair — non-production rollout manifest

This is a source repair. It is not a production promotion and not a new commercial GO.

Hosted changes: NONE.
Production effects: NONE.
The pinned tester is unchanged: product `a4f3284c35785dbb0efe3843d38084f12911ac15`, deployment `dpl_FAaW712WnVBZ9Wr7B8MXCurJEeXW`.

## Order

1. Review this source head.
2. Apply `supabase/migrations/20261010120000_pos_manual_mobile_money_attestation.sql` only on a non-production database after a separate runtime authorization.
3. Deploy the app that contains this repair only after that migration is applied.
4. Leave the previous a4 app in place until that order is done. The previous app does not select the new payment columns, so the additive columns do not break it.

Migration SHA-256: `96930E5BF71A0BD2C3874F2746739163EE8D5A92D679734A23E62D073A6B1BBF`.

The migration is still a proposal. It has not been applied to the hosted project or to the retained restore database.

## Safe configuration

Leave these off until a reviewed non-production trial:

- `MANUAL_MOBILE_MONEY_ENABLED` is not `true`
- `PAYSTACK_MODE` is not `live`
- no `sk_live_` key is used for POS checkout

Manual Mobile Money also needs `MANUAL_MOBILE_MONEY_NETWORK` and `MANUAL_MOBILE_MONEY_ACCOUNT_LABEL`. Those values are saved on the payment when the instructions are shown. A later change does not move an existing payment.

Paystack test checkout still needs the shared test configuration: provider `paystack`, mode `test`, an `sk_test_` key, and a usable test payer. A key alone is not a usable checkout. Live checkout stays blocked.

## Rollback

Do not deploy this app onto a database that does not have the migration. If the migration is applied and the new app is not deployed, the previous app keeps working because it does not read the new columns. Do not drop the new columns while any payment has used them. Do not ask a customer for a second transfer to recover a confirmation whose response was lost.

## What this head does not prove

Two-session database concurrency, hosted apply, a real Paystack call, and cashier acceptance on the pinned tester are not claimed here. Local checks covered the PostgREST 409 negative control, in-memory attestation races, refund isolation, presentation authorization, the status payload guard, and the cashier wording test. Full Linux/Windows CI on this head is the next source check after this commit is pushed.
