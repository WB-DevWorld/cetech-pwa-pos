# R6 isolated training cash sale — durable runtime

Kind: IMPLEMENTATION_EVIDENCE
UTC: 2026-09-15T10:05:00Z
Editor: `@wbdevworld` / WS3 (R6 integration editor)
Neutral branch: `batch/r6-first-real-cash-sale`
PR: #55 (draft; not review-ready; do not merge)
Production promotion: NOT AUTHORIZED

This is the bounded training rehearsal authorized by the R6-REM-01 senior grant. It is **not** production cutover. Issue #4 remains OPEN.

## Authority (not retroactive)

Ben checkpoint review (`@Ben-001-sys`) on `eac32cdff60f0f6ed80bb0908f9091543c859ead`: **COMMENTED**, not approval.

- Finding A: CORE-06 `0162e408…` exceeded issue #25 declared paths. Those still-required files were revalidated under R6-REM-01; history is not rewritten.
- Finding B: ephemeral in-memory checkout + empty memory assignment directory. Durable adapters were implemented, then used for this sale.

Lease: `R6-REM-01`. Authority checkpoint `f547542ca23efaf61243909c320d7dd900709188`. Same human/workstream (`@wbdevworld` / WS3). Expires when this candidate is frozen or PR #55 closes/merges.

## Topology actually used

```text
local durable Supabase (seed org_a / cashier_a / loc_a1 / reg_a)
+ APP_ENV=staging BFF (fail-closed durable session, assignment, checkout)
+ training Woo + BR-07 0.4.0-br07 at https://training.cetechbpa.com
```

No `NEXT_PUBLIC_BRIDGE_*`. Bridge credentials stayed server-only. Node 24 required `--use-system-ca` on the Windows BFF host (`UNABLE_TO_VERIFY_LEAF_SIGNATURE` without it). That is a workstation TLS trust setting, not a Woo safeguard change.

Guest/`walkin` quoting remains refused by B2BKing on training (R3 `REFUSAL_MATCH`). This sale used the authorized synthetic test customer `r6-cash-sale@training.invalid` as retail user **26** (`b2bking_b2buser=no`). Users 8 and 13 were not reused as the commercial actor. Product `49111` qty 1.

## Training bridge deploy

| Item | Value |
| --- | --- |
| Previous plugin | `0.2.7-br02` |
| Installed plugin | `0.4.0-br07` active |
| Source tree `HEAD:wordpress/cetech-pos-bridge` | `2c0879ec9a078dd49b40dbb835b45ee2ee956464` |
| `git archive` SHA-256 (tar of that tree, this workstation) | `AD6FF48AE5B67A4E337831CA9544D8BA10EB1F72941E189415AB72BCE36F8448` |
| Installed `cetech-pos-bridge.php` SHA-256 | `7f6d34a7249c536d7ade3bd5b1f0dac84ba01f83c2d5327a766d05a66083e182` |
| Rollback tarball | `/home/cetechtraining/cetech-pos-bridge-0.2.7-br02-rollback-20260915T092949Z.tgz` |
| Rollback SHA-256 | `e653ae7f6abe109a6233ccbc9d5548780d6ac8f73cc896ee696d1e60f4dfa77b` |
| Anonymous health | HTTP 401 `AUTH_REQUIRED` |
| Authenticated health | HTTP 200 (W4 secret used on-host only; not printed) |
| Service user | ID 22 subscriber; `cetech_pos_bridge_access=YES`; `manage_options=NO`; `manage_woocommerce=NO` |

WS2 plugin source was not edited. Plugin deploy did not create a Woo order (HPOS stayed 51 until prepare).

## Safety immediately before mutation

| Check | Result |
| --- | --- |
| Hostname | `cetechtrainingappserver` |
| `home` / `siteurl` | `https://training.cetechbpa.com` |
| `WP_ENVIRONMENT_TYPE` | `staging` |
| W1 MU | PRESENT |
| MailPoet | inactive |
| Notify domains | `training.invalid` |
| Webhooks | 0 |
| Mail queue | empty |
| Paystack | inactive |
| VitePOS adapter | `'0'` |
| HPOS before | 51 |
| SKU `49111` stock/price | 6 / 29 |

## Sale identifiers

| Field | Value |
| --- | --- |
| Authoritative quote | `q9692c278ac74e88a15106464b4b435de` total **GHS 29.00** (`minor` 2900) fingerprint `0cd43d2c59b7ca2cb8292cb8cce9dc809ea0bf37822f900b418f75b0bc84bbc1` |
| POS transaction | `53478b8d-5abf-4522-81d2-3a7ca89f3243` |
| Woo order | **49439** (`sale-49439`) |
| Shift | `b0070067-8ca5-4e70-97fd-8221be0017a4` |
| Cash payment | `3f6a39b5-b3e9-44ef-97e6-fb911ed87d6d` verified |
| Receipt | `rcpt-53478b8d` / `POS-49439` |
| Prepare key | `a0c818bd-42a0-467b-ac9e-d3e20d656f20` |
| Cash key | `15429b52-b422-4f12-af6a-bbac06bacfd0` |
| Finalize key | `b1fdebe5-15c9-40fc-8073-497e3a062788` |

## Side effects

| Fingerprint | Before | After prepare | After complete |
| --- | --- | --- | --- |
| HPOS `wc_orders` | 51 | 52 | 52 |
| SKU `49111` `_stock` | 6 | 6 (hold) | **5** |
| Woo 49439 | — | `pending` unpaid | `processing` **paid** |
| Mail queue | empty | empty | empty |
| Webhooks | 0 | 0 | 0 |
| Paystack | inactive | inactive | inactive |

```text
exactly 1 Woo order (49439)
exactly 1 intended stock effect (6 → 5)
exactly 1 cash tender (payment 3f6a39b5-…)
exactly 1 completed POS transaction
exactly 1 receipt (rcpt-53478b8d)
0 real-money electronic charges
0 unexpected real-customer messages from this sale
0 duplicate commercial effects
```

The synthetic Woo order, POS sale, cash row, and receipt are **kept** as staging evidence. No refund/return/stock restore was performed.

## Recovery

| Step | Result |
| --- | --- |
| Prepare replay (same key+body) | same `sale-49439`; HPOS +0 vs first prepare |
| Prepare conflict (same key, altered fingerprint) | `IDEMPOTENCY_CONFLICT`; still one order |
| Prepare resolve | `prepared` |
| Process restart after prepare | BFF destroyed/recreated with `APP_ENV=staging`; cash used recovered durable state |
| Cash replay | same `paymentId` |
| First finalize | `requires_attention` — Woo still pending unpaid. Cause: PostgREST `timestamptz` `+00:00` failed frozen `Timestamp` (`…Z`) on `VerifiedPaymentEvidence`. No second order. |
| Repair finalize (same key after timestamp normalization) | `completed`; Woo paid; stock 5; receipt written |
| Finalize replay | same sale/receipt; stock stayed 5; HPOS stayed 52 |
| Process restart after complete | GET sale `completed` + GET receipt `rcpt-53478b8d` |

Do not treat the first finalize `requires_attention` as a lost write that licenses a second sale. Commercial truth was determined (one pending order, one POS cash row, finalize not bound). Repair used the same transaction/keys.

Follow-up adapter fix: rem source `b95f4df06064af167770c6e36bb2c049412f7692`; imported `c6a9318222f11c8b7a150c8bb558749fcf845f76`.

## Mail containment after the sale

W1 sink grew 10 → 13. The three new lines (UTC `2026-09-15T10:01:58Z`–`10:01:59Z`) are all `to_domains: training.invalid`:

- Product low in stock
- New order `#49439`
- Customer “order has been received”

`mailq` remained empty. Historical `gmail.com` sink rows are dated 2026-09-14, not this sale.

## Local automated gate (this workstation, after timestamp fix)

| Check | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `python -m unittest discover -s tests/tooling -v` | 48 tests OK |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | 57 files / **434** passed |
| `pnpm --dir apps/pos-web build` | PASS |
| `pnpm --dir apps/pos-web test:e2e` | **7** passed |
| `git diff --check` | PASS |
| `php .../derive-quote-contract.php --check` | PASS (`artifact matches the canonical contract`) |
| PHP lint of bridge + `tests/bridge` | 0 failures (`make check` is bash-only on this Windows host) |
| `php tests/bridge/run.php` | **1297** passed / 0 failed |
| `php tests/bridge/parity.php` | **138** passed / 0 failed / **19** permission-required skipped |
| `supabase db reset --yes --local` | PASS (all migrations including `20260915090000_pos_durable_checkout.sql` + seed) |
| `supabase test db` | Files=3, Tests=**105** PASS |

Local POS operational rows for this sale were snapshotted (`completed` / `sale-49439` / `rcpt-53478b8d` / one `cash_sale` 2900) then wiped by the required fresh pgTAP reset. Training Woo order **49439** and stock 5 remain as live staging evidence.

## Limits

- Local Supabase is the authorized isolated POS operational database for this rehearsal, not a separate hosted staging Supabase.
- `pricingParityVerified` remains false. Issue #4 remains OPEN.
- Receipt line `name` is the SKU/`49111` label from the quote bridge, not a merchandising rename.
- Woo `EVIDENCE_META` was empty after complete; `PAY_META` matched the POS payment id.
- Production, Paystack/MoMo/card, returns/refunds, and R7 were not authorized and were not performed.
