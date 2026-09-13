# CP04-W2 data / write boundary (R2 health/install operation)

Observer: WS3 senior / @wbdevworld  
UTC: `2026-09-12T23:59:42Z`–`2026-09-13T00:03Z`  
Host: `https://training.cetechbpa.com`  
Method: public REST + SSH WP-CLI **read-only**. No production SSH. No PII export.

## Confirmed test environment

| Resource | Observed | Status |
| --- | --- | --- |
| WordPress host | Public `https://training.cetechbpa.com`; SSH hostname `cetechtrainingappserver`; WP path `/home/cetechtraining/htdocs/training.cetechbpa.com` | VERIFIED |
| `WP_ENVIRONMENT_TYPE` | `staging` | VERIFIED |
| home / siteurl | `https://training.cetechbpa.com` | VERIFIED |
| Site identity | REST `name` contains `TRAINING` | VERIFIED |
| Database fingerprint | Historical sha256 `65da6808c0b3559426fbb5479b04c6c98816bf5234aa1778423563b439a26b1e` of `DB_HOST\|DB_NAME\|table_prefix` (2026-09-12). Not recomputed this pass | historical VERIFIED; this pass not repeated |
| DB host class | historical private RFC1918; name contains `train` | historical VERIFIED |
| HPOS | `woocommerce_custom_orders_table_enabled=yes`; data-sync **no** | VERIFIED refresh |
| Order store | HPOS `wp_wc_orders` count **51** | VERIFIED count only |
| Users | **20** rows | VERIFIED count only |
| Stock/catalog | Woo `manage_stock` historically yes; catalog not re-exported | historical; no PII |
| Uploads/object storage | not inspected | UNVERIFIED |
| Auth / user store | WordPress users table; Application Passwords advertised on REST | VERIFIED availability; no password created |
| Notification systems | MailPoet active; Woo notify flags yes; Postfix installed | VERIFIED; **UNSAFE** (see W1) |
| Webhooks | **0** | VERIFIED |
| Fulfillment | delivery engine active; VitePOS adapter `0` | VERIFIED |
| Bridge plugin filesystem | `wp-content/plugins/cetech-pos-bridge` **absent** | VERIFIED |
| Bridge REST | `HEAD /wp-json/cetech-pos/v1/health` **404**; namespace absent | VERIFIED |
| BFF/runtime destination | R2 code on `batch/r2-auth-bridge-bff` `3a1b6b5…` composes server-only `BRIDGE_BASE_URL` / `BRIDGE_USERNAME` / `BRIDGE_APPLICATION_PASSWORD`. No live BFF deploy or secret store was configured in this assignment | CODE on R2; live runtime UNVERIFIED |

Production Woo operations URL remains **UNVERIFIED**. Public `https://cetechbpa.com` is a distinct WP app (prior public audit). No production credential hunt.

## Write boundary for a later authorized W4

### Allowed by W4 when separately authorized

- Install the exact bridge artifact from BR-01 source `280a73dbcd53ac0e03883775b4fabdec7465a4a8` (imported on R2 as `0ac2e38befb54c9ada404e6854a80285bebb69b9`).
- Activate that plugin only.
- Create one dedicated synthetic WordPress service user.
- Provision one Application Password for that user.
- Add only capability `cetech_pos_bridge_access`.
- Health GET requests with `X-Correlation-ID`.
- Read-only Woo/WoodMart/B2BKing detection as returned by that GET.

### Not allowed

- Order creation or order state changes
- Stock mutation
- Customer account mutation
- Pricing changes
- Payment execution / refunds
- Email / customer notification
- Production writes
- Unrelated WordPress setting changes
- `NEXT_PUBLIC_BRIDGE_USERNAME` / `NEXT_PUBLIC_BRIDGE_APPLICATION_PASSWORD`

Order writes authorized: **NO**  
Stock writes authorized: **NO**  
Payment writes authorized: **NO**

## Accidental-write detection (pre-operation fingerprints)

Recorded now, before any W4:

| Fingerprint | Value | UTC |
| --- | --- | --- |
| HPOS order count | 51 | 2026-09-13 ~00:02Z |
| Woo webhook count | 0 | 2026-09-13 ~00:02Z |
| User count | 20 | 2026-09-13 ~00:02Z |
| Bridge plugin dir | absent | 2026-09-13 ~00:02Z |
| Bridge REST | 404 / namespace absent | 2026-09-12T23:58:58Z |
| MailPoet | active 5.37.0 | 2026-09-13 ~00:02Z |

Stock aggregate was not recomputed (avoid catalog/PII). Historical manage-stock=yes remains.

## Post-W4 fingerprints (`2026-09-13T06:23:54Z`)

| Fingerprint | Value |
| --- | --- |
| HPOS order count | 51 (unchanged) |
| Woo webhook count | 0 (unchanged) |
| User count | 21 (approved service user only) |
| Bridge plugin | `cetech-pos-bridge` active `0.1.0-br01` |
| Bridge REST | 401 anonymous / 200 authenticated-with-cap |
| MailPoet | inactive |
| W1 intercept | still loaded |

## Rollback owners

| Change (only if later authorized) | Owner | Rollback |
| --- | --- | --- |
| Plugin install/activate | WS3 + operator | deactivate + delete plugin dir |
| Service user / capability / Application Password | operator | revoke password; remove cap; disable/delete user |
| W1 mail containment | operator | restore only if operator wants prior MailPoet/admin mail |

## Remaining unknowns

- Production DB fingerprint comparison
- Whether MailPoet/Postfix would emit during plugin activate
- Code Snippets runtime behaviour
- Delivery-engine incidental behaviour on activate
- Live BFF secret-storage location

CP04-W2 = **PASS** as a resource/write-boundary map. Post-W4 fingerprints show only the approved plugin/user writes. Staging vs production isolation remains NOT PROVEN.
