# CP04-W1 containment apply (training)

Observer: WS3 senior / @wbdevworld
Host: `https://training.cetechbpa.com` (`cetechtrainingappserver`, `WP_ENVIRONMENT_TYPE=staging`)
Operator authorization: 2026-09-13 user instruction granting CP04-W1 containment on training only (not W4, not production, not orders/stock/payments). No external mailbox was named.
Approved sink: logical `cp04-w1-sink@training.invalid` (RFC 2606 non-routable) plus host-local capture `/home/cetechtraining/cetech-cp04-w1-mail-sink.log`
START_FRESHNESS_UTC: `2026-09-13T00:20:37Z`
START_MAIN_SHA: `aa08d74f2cb99301817e5995f01486acb7e2169f`
START_R2_SHA: `3a1b6b579781130afc9bd9792405b182c7bfe5ca`
Apply window UTC: `2026-09-13T06:03:53Z`–`2026-09-13T06:05:13Z`

W4 / bridge install / service user / Application Password: **not performed**.

## Previous configuration (redacted)

Recorded on-host at `/home/cetechtraining/cetech-cp04-w1-rollback.json` (PII present; not copied to git).

| Item | Previous | After apply |
| --- | --- | --- |
| MailPoet | 5.37.0 **active**; `mta_group=mailpoet`; `send_transactional_emails=1`; sending queues 0; scheduled tasks 17 | **inactive** |
| `admin_email` domain | `cetechbpa.com` | `training.invalid` |
| Woo stock notify recipient domain | `cetechbpa.com` | `training.invalid` |
| Woo new-order recipient domain | `gmail.com` | `training.invalid` |
| Woo from-address domain | `training.cetechbpa.com` | unchanged (FROM, not destination) |
| Low/no-stock notify flags | yes/yes | unchanged |
| Woo webhooks | 0 | 0 |
| HPOS order count | 51 | 51 |
| MU intercept | absent | `cetech-cp04-w1-mail-containment.php` present; `pre_wp_mail` FILTER_YES |

## Mutations applied (authorized)

1. Installed MU intercept that short-circuits `wp_mail` and appends domain/subject JSON to the capture file.
2. Wrote host-local rollback JSON.
3. `wp plugin deactivate mailpoet`.
4. Redirected `admin_email`, `woocommerce_stock_email_recipient`, and `woocommerce_new_order_settings.recipient` to `cp04-w1-sink@training.invalid`.
5. Kept Woo webhooks at 0. No webhook added.

`cetech-training-safety.php` COD/noindex behavior was not edited. MailPoet deactivation plus the intercept supersede its previous “MailPoet allowed to send” comment.

## Synthetic proof

Correlation: `8f3c1a2e-9b47-4d21-a6c0-7b1e4d9c2a10`
`wp_mail` to `cp04-w1-sink@training.invalid` returned true (short-circuit success).
Capture file line 2 subject contains the correlation and `to_domains: ["training.invalid"]`.
`mailq` empty. `/var/log/mail.log` has no correlation (`MAILLOG_NO_CORR`). No `status=sent` / `cetechbpa.com` lines found in that log during the check.

Incidental capture (not a live send): during `admin_email` update, WordPress queued `[TRAINING] Admin Email Changed` toward domain `cetechbpa.com`. The intercept recorded it at `2026-09-13T06:04:20Z` and short-circuited delivery.

## Classification

CP04-W1 outbound/mail containment: **PASS** for the intended later R2 W4 health/install operation on this host.
Synthetic containment proof: **PASS**.
MailPoet sending: **SAFE while inactive**.
Woo webhooks: **SAFE** (count 0).
Unexpected orders/stock/payments: **0** from this operation.
Production touched: **NO**.
R3: **NOT STARTED**.
Issue #4: remains **OPEN**.

Rollback: `docs/runbooks/CP04-W1-ROLLBACK.md`. Do not undo containment unless the operator asks.
