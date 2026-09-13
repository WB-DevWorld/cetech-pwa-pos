# CP04-W1 outbound containment (R2 health/install operation)

Observer: WS3 senior / @wbdevworld  
UTC: public `2026-09-12T23:58:58Z`; SSH `2026-09-12T23:59:42Z`–`2026-09-13T00:03Z`  
Host: `https://training.cetechbpa.com` (public REST name contains `TRAINING`; SSH hostname `cetechtrainingappserver`; `home`/`siteurl` match; `WP_ENVIRONMENT_TYPE=staging`)  
Method: public HEAD/GET; existing SSH + WP-CLI **read-only**. No plugin/theme/setting changes. No Application Password. No synthetic mail/event. Production SSH not used.  
Declared R2 dependency (not edited): `origin/batch/r2-auth-bridge-bff` `3a1b6b579781130afc9bd9792405b182c7bfe5ca`

This file began as a read-only refresh of the 2026-09-12 authenticated audit (email **UNSAFE**, not silently upgraded). The 2026-09-13 operator-authorized apply is recorded below and in `CP04-W1-CONTAINMENT-APPLY.md`.

## Intended operation

R2 live acceptance needs CP04-W4: install/activate the exact BR-01 bridge artifact, create a dedicated least-privilege service user + Application Password, grant only `cetech_pos_bridge_access`, then GET `/wp-json/cetech-pos/v1/health`. Those remote writes are **not** authorized by this assignment prompt.

## Outbound-boundary matrix

| Channel | Responsible plugin/system | Destination | Current configuration | Can fire during W4 install/activate/health GET? | Classification | Required containment | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WordPress / Woo transactional email | Core `wp_mail` + WooCommerce 11.1.0; Postfix 3.8.6 on host (`inet_interfaces=all`) | Destinations redirected to `cp04-w1-sink@training.invalid`. Woo from-address domain still `training.cetechbpa.com` (FROM only). MU intercept short-circuits `wp_mail` | Low/no-stock notify **yes/yes**; recipients now `.invalid`. Host MTA present but unused by `wp_mail` while intercept is loaded | Activate/cron may still *call* `wp_mail`; delivery is captured | **SAFE** while MU intercept remains loaded and destinations remain `.invalid` | Keep intercept + sink; do not restore live recipients before W4 | Restore rollback JSON + remove MU only if operator requests |
| MailPoet | MailPoet **5.37.0 inactive** after W1 apply | Previously `mta_group=mailpoet` (own sending path). Recipients not enumerated | Deactivated `2026-09-13T06:04Z`. Existing `cetech-training-safety.php` comment is stale; plugin is inactive | Not while inactive | **SAFE** while inactive | Leave inactive until operator restores it | `wp plugin activate mailpoet` only if operator wants MailPoet kept |
| Woo webhooks | WooCommerce | none | Count **0** (refreshed `wp_wc_webhooks`) | Unlikely unless a webhook is added | **SAFE** for W4 *if count remains 0* | Keep at 0; do not add destinations | Delete any webhook added in error |
| Fulfillment / delivery | `cetech-woocommerce-delivery-engine` 1.0.0-rc.9 **active** | plugin-defined (not dumped) | `cetech_de_enable_vitepos_adapter=0` | Health GET should not create deliveries; activate could load plugin code | **UNVERIFIED** for incidental activate side effects; no send test | Do not enable VitePOS adapter; no delivery writes | Restore adapter flag `0` |
| Customer chat / WhatsApp widget | Chaty 3.6.0 **active** | widget destinations unknown | Active storefront widget | Unlikely from health GET; not a proof of containment | **UNVERIFIED** | No chat tests; do not treat as mail sink | n/a (no change proposed) |
| Contact forms | Contact Form 7 6.1.7 **active** | form mail recipients unknown (not exported) | Active | Unlikely unless a form is submitted | **UNVERIFIED** | Do not submit forms | n/a |
| Internal tickets | Support Genix 1.8.54 + lite 1.4.54 **active** | unknown | Active | Unverified staff notify | **UNVERIFIED** | No ticket tests | n/a |
| Purchasing | PurchaseDesk 1.0.11 **active** | unknown | Active | Unlikely from health GET | **UNVERIFIED** | No purchase tests | n/a |
| Push | `push-notification` **inactive**; public `wc-push-notifications` historically present | n/a while inactive | Inactive | No | **SAFE** while inactive | Leave inactive | n/a |
| Jetpack / Google Listings | both **inactive** | n/a | Inactive | No | **SAFE** while inactive | Leave inactive | n/a |
| Paystack / card / MoMo | Paystack plugin **inactive**; MU safety filter limits storefront gateways to COD | no active Woo card/MoMo gateway | Invoice gateway still installed; MU filter unsets non-COD at `woocommerce_available_payment_gateways` | Health GET must not checkout | **SAFE** for *health GET* only; not a payment sandbox | No checkout | n/a |
| SMS | no dedicated Twilio/SMS plugin in the filtered active list | unknown | none observed | Unverified | **UNVERIFIED** | No SMS tests | n/a |
| REST callbacks / automations | Redirection 5.10.0 active; Code Snippets 3.10.2 active | snippet destinations not dumped | Active | Snippets could run on `plugins_loaded` | **UNVERIFIED** | Do not add snippets; W4 must not depend on snippet side effects | n/a |
| WP-cron / Action Scheduler | Woo + MailPoet + MU `cetech-action-scheduler-web-runner-guard.php` | mail hooks not re-counted this pass (quoting limit) | Cron capable | Yes | **UNVERIFIED** counts; mail still **UNSAFE** qualitatively | Contain mail before W4 | n/a |

Zero Woo webhooks **does not** by itself prove outbound containment. After the W1 apply, MailPoet is inactive, `wp_mail` is intercepted, and admin/Woo notify destinations are `training.invalid`. Re-check this matrix before restoring MailPoet or removing the intercept.

## Mail containment

**PASS** after authorized apply `2026-09-13T06:03:53Z`–`2026-09-13T06:05:13Z`. See `CP04-W1-CONTAINMENT-APPLY.md`.

Approved test sink: `cp04-w1-sink@training.invalid` plus `/home/cetechtraining/cetech-cp04-w1-mail-sink.log`.
Synthetic containment event: **PASS** (correlation `8f3c1a2e-9b47-4d21-a6c0-7b1e4d9c2a10` captured; mail queue empty; UUID absent from mail.log).

## W1 mutation gate (APPLIED)

| Item | Value |
| --- | --- |
| Host | `https://training.cetechbpa.com` / `cetechtrainingappserver` |
| Applied changes | 1) MU `pre_wp_mail` intercept. 2) MailPoet 5.37.0 deactivated. 3) `admin_email`, stock-notify, and new-order recipient redirected to `cp04-w1-sink@training.invalid`. 4) Woo webhooks kept at 0. |
| Previous values | MailPoet active 5.37.0 / `mta_group=mailpoet`; `admin_email` domain `cetechbpa.com`; stock-notify domain `cetechbpa.com`; new-order recipient domain `gmail.com`; webhooks 0 |
| Expected side effects | Training MailPoet newsletters/transactional MailPoet mail stopped while inactive; admin/Woo notify destinations are non-routable |
| Operator authorizer | user 2026-09-13 CP04-W1 training-only authorization |
| Rollback | Host JSON `/home/cetechtraining/cetech-cp04-w1-rollback.json`; procedure `docs/runbooks/CP04-W1-ROLLBACK.md`. Do not auto-undo. |

## Closure

CP04-W1 = **PASS** for the intended R2 W4 health/install operation on this host.

Remote W4 remains **not authorized** by the W1 grant. Do not install the bridge or create a service user until a separate W4 authorization.
