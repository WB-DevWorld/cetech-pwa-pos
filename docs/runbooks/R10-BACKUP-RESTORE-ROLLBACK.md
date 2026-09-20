# R10 backup, restore and rollback rehearsal

Status: **PREPARED — execution requires the appropriate environment/operator authorization**

STG-01 and REC-01 acceptance do not satisfy this rehearsal. Backup/restore remains unexecuted. This runbook separates application rollback from business-effect recovery. Reverting code does not reverse orders, payments, stock changes, refunds, messages or applied database changes.

## Recovery inventory

Before any pilot, record recoverability for:

| Area | Required artifact / proof |
| --- | --- |
| Git/application | exact release SHA, previous known-good SHA, build/deployment identifiers |
| WordPress/Woo | database backup plus files/plugins/configuration backup |
| CETECH POS Bridge | exact plugin artifact/version and prior rollback artifact |
| Supabase | database backup/dump and committed migration history |
| Deployment environment | recoverable non-secret environment/config inventory |
| Secrets | documented recovery/rotation ownership; never copy secret values into Git evidence |
| VitePOS | version, settings/config evidence, outlets/counters, payment methods, print config |
| Operational state | active shifts, pending operations, Woo order cutoff, stock reconciliation snapshot |
| Recovery contacts | out-of-band contacts/owners for hosting, WP, Supabase, payment provider |

Missing recovery ownership is a release blocker for the affected capability.

## A. Backup verification

For each backup, record:

- timestamp UTC;
- environment;
- scope;
- storage/location reference;
- checksum or provider snapshot ID where available;
- operator;
- retention expectation;
- whether restore has been independently tested.

"Backup exists" is not equivalent to "restore works."

## B. Isolated restore rehearsal

Never restore over production merely to prove recovery.

1. Select an isolated restore target.
2. Restore WordPress DB/files or the applicable snapshot.
3. Restore Supabase into an isolated supported target or use an approved restore mechanism.
4. apply/verify migrations as required;
5. verify application can connect using isolated credentials;
6. verify representative records:
   - known Woo order;
   - representative product/stock;
   - POS transaction;
   - shift;
   - receipt;
   - payment/refund references without exposing secrets;
7. run read-only health/consistency checks;
8. record elapsed procedure steps and any missing dependency.

If a provider restore cannot be rehearsed safely, record BLOCKED plus the provider-supported recovery path and owner.

## C. Application deployment rollback

Application rollback must be rehearsed independently of commerce reversal.

1. Record current release SHA/build.
2. Deploy the previous known-good application build to staging.
3. Do not delete database rows created by the newer version.
4. Verify old and new schema compatibility across the rollback window.
5. Verify durable pending operations remain visible/resolvable.
6. Redeploy the candidate and verify forward recovery.
7. Record whether a destructive migration would prevent rollback. If yes, release is blocked until an additive/forward-repair path is established.

## D. Bridge rollback

1. Record active bridge version and exact plugin artifact.
2. Keep the prior artifact available.
3. On isolated/training environment only, rehearse plugin replacement/rollback if authorized.
4. Re-run authenticated health and capability checks.
5. Do not assume code rollback reverses Woo orders/stock/payment effects already performed.

## E. Business-effect reconciliation before traffic rollback

If cashier traffic must move back to VitePOS or a prior application:

1. stop new new-POS transactions;
2. enumerate every pending/requires-attention operation;
3. resolve payment provider state before any payment retry;
4. resolve Woo order state before any order retry;
5. resolve refund/stock-disposition effects independently;
6. record the last accepted new-POS Woo order and timestamp;
7. preserve legitimate historical orders/receipts/audit;
8. cancel/refund through normal business workflows where reversal is actually required;
9. never raw-delete business rows to make rollback appear clean.

## Rollback triggers to qualify

At minimum rehearse/define response for:

- duplicate-order defect;
- wrong authoritative price/tax;
- unexplained stock effect;
- payment succeeded but sale completion ambiguous;
- repeated checkout failure;
- critical session/auth/CSRF failure;
- local-state/update loss;
- receipt/compliance blocker;
- provider outage;
- deployment regression.

## Evidence

Use `docs/integration/evidence/R10/R10-EVIDENCE-TEMPLATE.md`.

REL-01 must not claim rollback proven until at least the application rollback and the required backup/restore path have recorded evidence appropriate to the intended pilot.
