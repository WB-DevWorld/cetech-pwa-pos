# CP04-W1 outbound containment (R2 health/install operation)

Observer: WS3 senior / @wbdevworld  
UTC: public `2026-09-12T23:58:58Z`; SSH `2026-09-12T23:59:42Z`–`2026-09-13T00:03Z`  
Host: `https://training.cetechbpa.com` (public REST name contains `TRAINING`; SSH hostname `cetechtrainingappserver`; `home`/`siteurl` match; `WP_ENVIRONMENT_TYPE=staging`)  
Method: public HEAD/GET; existing SSH + WP-CLI **read-only**. No plugin/theme/setting changes. No Application Password. No synthetic mail/event. Production SSH not used.  
Declared R2 dependency (not edited): `origin/batch/r2-auth-bridge-bff` `3a1b6b579781130afc9bd9792405b182c7bfe5ca`

This observation **refreshes** the 2026-09-12 authenticated audit. It does **not** silently upgrade the previous email **UNSAFE** finding.

## Intended operation

R2 live acceptance needs CP04-W4: install/activate the exact BR-01 bridge artifact, create a dedicated least-privilege service user + Application Password, grant only `cetech_pos_bridge_access`, then GET `/wp-json/cetech-pos/v1/health`. Those remote writes are **not** authorized by this assignment prompt.

## Outbound-boundary matrix

| Channel | Responsible plugin/system | Destination | Current configuration | Can fire during W4 install/activate/health GET? | Classification | Required containment | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WordPress / Woo transactional email | Core `wp_mail` + WooCommerce 11.1.0; Postfix 3.8.6 on host (`inet_interfaces=all`) | `admin_email` domain **`cetechbpa.com`** (refreshed). Woo from-address domain historically `training.cetechbpa.com` (2026-09-12); this pass did not re-parse that option | Low/no-stock notify **yes/yes**. No dedicated SMTP plugin in the active set. Host MTA present | Yes, if WP-cron/Woo/MailPoet/admin notices run during plugin activate | **UNSAFE** | Approved test sink or disable Woo/admin customer/staff mail before W4 | Restore previous notify flags / from-address / MTA only if operator changed them |
| MailPoet | MailPoet **5.37.0 active** | MailPoet sending path (API/MTA). Recipients not enumerated (no PII export) | MU plugin `cetech-training-safety.php` (47 lines) states: *“MailPoet itself is intentionally allowed to send email.”* Plugin also forces `blog_public=0` and noindex headers; checkout gateway filter keeps COD for storefront | Yes. Activate/cron can coincide with MailPoet send | **UNSAFE** | Operator must disable MailPoet sending, deactivate MailPoet, or route to an approved sink **before** W4 | Re-enable only if operator wants MailPoet kept; do not auto-undo intended containment |
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

Zero Woo webhooks **does not** prove outbound containment. MailPoet + production-domain `admin_email` + host Postfix remain sufficient to email live recipients.

## Mail containment

**UNSAFE** (refresh agrees with 2026-09-12). Not upgraded.

Approved test sink: **not established**.  
Synthetic containment event: **NOT RUN** (must not send mail before containment).

## W1 mutation gate (NOT applied)

| Item | Value |
| --- | --- |
| Host | `https://training.cetechbpa.com` / `cetechtrainingappserver` |
| Proposed changes | 1) Stop MailPoet sending or deactivate MailPoet. 2) Point `admin_email` / Woo notification recipients at an operator-approved non-customer sink. 3) Disable Woo customer emails or confirm they cannot reach `cetechbpa.com`. 4) Keep Woo webhooks at 0. |
| Previous values | MailPoet active 5.37.0; MU comment allows MailPoet mail; `admin_email` domain `cetechbpa.com`; webhooks 0; stock notify yes/yes |
| Expected side effects | Training marketing/newsletters via MailPoet would stop until re-enabled |
| Operator authorizer | **absent for this assignment** |
| Rollback | Restore MailPoet status, `admin_email`, Woo email flags, webhook count; do not undo containment the operator later chooses to keep |

## Closure

CP04-W1 = **BLOCKED** for the intended R2 W4 operation.

Relevant paths are mapped. Applicable mail paths are **not** captured/blocked. No approved sink. No synthetic proof. Do **not** proceed to remote W4 until the operator authorizes and evidences containment.
