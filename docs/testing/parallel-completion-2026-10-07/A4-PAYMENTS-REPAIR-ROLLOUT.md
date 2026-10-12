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

Migration SHA-256: `9E376F9533B28A1593A42A2DC95176EF96D754A6AAEACAA87F2642FBFC8E932E`.

The earlier hash `96930E5BF71A0BD2C3874F2746739163EE8D5A92D679734A23E62D073A6B1BBF` is the previous proposal. Do not apply that file. The current file also rejects a status change, an organisation or sale rebinding, and deletion of a verified manual attestation.

The migration is still a proposal. It has not been applied to the hosted project or to the retained restore database. It was applied only to disposable local database `a4_pay_cas_20261012` on the local Supabase cluster, together with the repo migration chain and `supabase/seed.sql`. That database is not the retained restore.

Qualification changes: `f77a61eb13ffb0cd19eb1dc815eee3725f3a36be`. The published head is the commit that contains this sentence.

## Safe configuration

Leave these off until a reviewed non-production trial:

- `MANUAL_MOBILE_MONEY_ENABLED` is not `true`
- `PAYSTACK_MODE` is not `live`
- no `sk_live_` key is used for POS checkout

Manual Mobile Money also needs `MANUAL_MOBILE_MONEY_NETWORK` and `MANUAL_MOBILE_MONEY_ACCOUNT_LABEL`. Those values are saved on the payment when the instructions are shown. A later change does not move an existing payment.

Paystack test checkout still needs the shared test configuration: provider `paystack`, mode `test`, an `sk_test_` key, and a usable test payer. A key alone is not a usable checkout. Live checkout stays blocked.

## Rollback

Do not deploy this app onto a database that does not have the migration. If the migration is applied and the new app is not deployed, the previous app keeps working because it does not read the new columns. Do not drop the new columns while any payment has used them. Do not ask a customer for a second transfer to recover a confirmation whose response was lost.

## What this publication proves

Local cart quantity 2 survives a reload in `e2e/sell-runtime.spec.ts`, and the restore count stays 1. The quantity shown in the cart is the last draft whose local save has finished.

On `a4_pay_cas_20261012`, two database sessions overlapped on row locks:

- one confirmation won `MM-WIN` for cashier `cashier_a`; the other session updated 0 rows;
- one shared merchant reference verified one sale and the other stayed `awaiting_customer` with unique violation `23505`;
- repeating the winning confirmation changed 0 rows;
- a cash claim rejected a manual insert with `sale tender family conflict`;
- a Paystack row rejected a second payment on the same sale with `23505`;
- changing or deleting the winning attestation raised `23514`;
- missing source, network, actor, reference, evidence, and timestamp raised `23514`;
- `anon` and `authenticated` received `42501`;
- the manual confirmations created 0 cash movements.

Connected tests cover a lost manual confirmation journal, a remount that keeps the same keys, a failed local save that returns no keys, cash and cancel staying closed during manual work, one receipt carrying `MM-WIN` after a lost finalize, and Paystack presentation refusing a password change, a removed assignment, the wrong register, and a finished sale. Sale B does not receive sale A's link.

## Proposed next runtime action

Do not execute this from the source publication.

1. Keep the accepted tester at product `a4f3284c35785dbb0efe3843d38084f12911ac15`.
2. Apply only the current migration file, hash above, to the confirmed non-production database before deploying an app that selects the new columns.
3. Deploy this source as a new preview. Do not point the accepted tester at that preview.
4. Manual payment check: one new sale, cap GHS 1.00, one merchant reference, no second transfer.
5. Paystack TEST check: one new sale, cap GHS 1.00, test mode and an `sk_test_` key only, one allowlisted link.
6. Recovery check: reopen those same two sales. Do not create another charge, and do not use sale 50343 or the consumed GHS 29 cash allowance.
7. While signed in, read status and payment capabilities, then complete the checkout and read the receipt.
8. Rollback: stop using the new preview, leave the additive columns in place, and keep the previous a4 app.

Staff impact: the training guide now says the cart quantity is the quantity saved on this device, and workbook T111 expects those visible quantities after reload. Payment instructions are unchanged. The proposed tester link does not exist until the separate preview deploy is accepted.

## What this head does not prove

Hosted apply, a real Paystack call, cashier acceptance on the pinned tester, and hosted speed are not claimed. Linux/Windows CI must be read from the run for the published commit, not from an earlier head.
