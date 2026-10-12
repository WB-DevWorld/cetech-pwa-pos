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

The earlier hash `96930E5BF71A0BD2C3874F2746739163EE8D5A92D679734A23E62D073A6B1BBF` is the previous proposal. Do not apply that file. The current file also rejects a status change, an organisation or sale rebinding, and deletion of a verified manual attestation. This closeout does not change that SQL.

The migration is still a proposal. It has not been applied to the hosted project or to the retained restore database. The isolated proof now runs on disposable database `a4_manual_attestation_cas`, which the CI script creates and drops. It is not the retained restore.

Cart and harness commit: `9940f264823e1c0025bd9a1bb9f27f2b0e8fdc83`.

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

The cart quantity, customer, quote, totals, and Pay button stay on the last snapshot whose local save has finished. A newer confirmed quote does not authorize Pay while that save is still running or has failed. The visible quantity stays on the saved value, including after a typed quantity is committed. A failed save says "Couldn't save this cart. Try again." and Pay stays unavailable until Try again finishes the save. The same revision on another cart or another customer does not authorize this cart. Reload still restores the saved quantity, and the existing restore count stays 1.

The manual attestation proof is `scripts/payments/manual_attestation_concurrency.sql`, run by `scripts/payments/run-manual-attestation-concurrency.sh` on its own database. It is not part of pgTAP discovery. On 12 October 2026 that script passed and then dropped `a4_manual_attestation_cas`. The log showed real lock overlap and these results:

- the loser updated 0 rows;
- the shared-reference loser was `23505` on `pos_checkout_payments_provider_reference_uq`;
- the identical retry updated 0 rows;
- cash against manual was `23514` sale tender family conflict;
- Paystack against manual was `23505` on `pos_checkout_payments_one_per_transaction`;
- update, delete, amount, and organisation changes were `23514`;
- missing source, network, actor, reference, evidence, and timestamp were `23514`;
- `anon` and `authenticated` were `42501`;
- manual confirmations created 0 cash movements;
- no `cas_log` row said unexpected success.

The same local cluster then ran all 23 files in `supabase/tests` on a fresh database, `a4_pgtap_clean`, after the full migration chain and `supabase/seed.sql`. All 23 passed, and that database was dropped. `supabase db reset` could not recreate the container from this Windows host, so this was the clean local substitute. Linux CI still runs `supabase test db` and then the concurrency script.

Connected payment tests from the previous repair are unchanged: lost manual confirmation, remount, failed local save, cash and cancel staying closed, one receipt carrying `MM-WIN`, and Paystack presentation refusing a password change, a removed assignment, the wrong register, and a finished sale.

## Runtime fixture decision

Do not execute a hosted sale from this publication. No retained read-only catalog row was identified here as a named product whose authoritative total is GHS 1.00. Do not invent that price or create a product to fit the cap.

Paystack's current API currency table lists Ghana cedis minimum as GHS 0.10 (10 pesewas): https://paystack.com/docs/api/. A GHS 1.00 cap is above that processor minimum. It is still not a named shop fixture. Woo's Paystack settings do not configure this POS.

Before any runtime GO, the owner fills one sheet:

- actual product or variation ID, customer type, location, register, and the authoritative total, which must be at least GHS 0.10 for a Paystack test charge and within the cap the owner accepts;
- starting stock and the maximum number of times that stock may decrease;
- the manual merchant network and account, and the person who will confirm the transfer;
- sandbox payer readiness, without copying any secret value;
- one new sale per tender, one reference or initialization each, and recovery reopening those same sales;
- stop conditions, the maximum number of transfers or provider effects, and the cleanup scope.

Until that sheet names a real variation, the GHS 1.00 figures below are a proposed ceiling, not a selected product.

## Proposed next runtime action

Do not execute this from the source publication.

1. Keep the accepted tester at product `a4f3284c35785dbb0efe3843d38084f12911ac15`.
2. Apply only the current migration file, hash above, to the confirmed non-production database before deploying an app that selects the new columns.
3. Deploy this source as a new preview. Do not point the accepted tester at that preview.
4. Manual payment check: one new sale at the named fixture, proposed ceiling GHS 1.00, one merchant reference, no second transfer.
5. Paystack TEST check: one new sale at the named fixture, proposed ceiling GHS 1.00, test mode and an `sk_test_` key only, one allowlisted link.
6. Recovery check: reopen those same two sales. Do not create another charge, and do not use sale 50343 or the consumed GHS 29 cash allowance.
7. While signed in, read status and payment capabilities, then complete the checkout and read the receipt.
8. Rollback: stop using the new preview, leave the additive columns in place, and keep the previous a4 app.

Staff impact: the training guide tells the cashier to wait on "Saving cart...", to select "Try again" when the save fails, and that Pay stays unavailable until the saved cart is the one on screen. Workbook T111 expects the visible quantities after reload and expects Try again to leave Pay unavailable until the save finishes.

## Separate local pricing measurement

No authenticated local quote was available on the isolated Woo copy. The last pair was an anonymous 401, so it is not a speed result. Issues #115 and #132 stay open. This payment candidate does not include a pricing change.

## What this head does not prove

Hosted apply, a real Paystack call, cashier acceptance on the pinned tester, and hosted speed are not claimed. Linux and Windows CI must be read from the run for the published commit, not from `9e12581850e166b518097225385e7166485057a2`, whose Linux pgTAP failed because the concurrency script was inside the shared suite.
