# CP-04 staging audit runbook

Repeatable, **read-only first** procedure for `https://training.cetechbpa.com` (or a later confirmed staging host). This is not a cutover plan and does not authorize production writes.

## Preconditions

- Work from a clean worktree on `ws3/cp-04-authenticated-staging-evidence` (or a later evidence branch). Do not reuse merged PR #36.
- Do not paste WordPress passwords, application passwords, Woo/Paystack/MoMo secrets, database URLs, or customer PII into chat, issues, or git.
- Do not install/activate plugins, change VitePOS/Woo/tax/payment settings, create orders, charge cards, trigger MoMo, or reduce stock.
- Prefer WP-CLI or admin screens over dumping `wp-config.php`, `wp config list`, all `wp_options`, Site Health, or Woo system reports.

## Classify every fact

Record: fact, observed value, environment, method, person, UTC time, evidence location, redactions, status (`VERIFIED` / `USER-CONFIRMED` / `USER-REPORTED` / `UNVERIFIED` / `BLOCKED` / `NOT APPLICABLE`), operational implication.

A public `₵` / SKU / FAQ sentence is display evidence only. Backend options need admin/WP-CLI or authenticated Woo GET.

## Phase 1 — public read-only (always)

```text
curl.exe -sS -I --max-time 20 --ssl-revoke-best-effort https://training.cetechbpa.com/
curl.exe -sS -I --max-time 20 --ssl-revoke-best-effort https://training.cetechbpa.com/wp-json/
curl.exe -sS --max-time 30 --ssl-revoke-best-effort https://training.cetechbpa.com/wp-json/
```

From `/wp-json/` keep only: `name`, `url`, `home`, `authentication` keys, namespace names of interest (`wc/*`, `vitepos/*`, `cetech-pos/*`). Do not commit the full route map.

Optional public reads:

- Store API `GET /wp-json/wc/store/v1/products?per_page=2` — record currency code/minor unit and whether SKU is present; do not commit catalog rows.
- Shop/homepage HTML generator meta and SKU **label counts**.
- FAQ / payment-and-delivery copy, with emails/phones redacted.
- `HEAD /wp-json/cetech-pos/v1/health` (expected 404 until BR-01).
- Comparison host identity (`https://cetechbpa.com/wp-json/` filtered the same way) to show distinct public apps — this is **not** database isolation.

Do **not** `POST` cart, checkout, VitePOS sale, or webhook calls.

If `GET /wp-json/vitepos/v1/basic/settings` is still unauthenticated, extract only non-secret fields (barcode field, stockable flag, POS mode, payment method **ids/titles/offline flags**, currency code). Redact VAT/TIN, logos are optional, never dump the raw JSON into git.

## Phase 2 — authenticated read-only (when isolation identity is known)

Preferred order:

1. Staging WP-CLI on the **operator-identified training origin** (no eval that writes). 2026-09-12: SSH as `ubuntu` to hostname `cetechtrainingappserver`; WordPress `/home/cetechtraining/htdocs/training.cetechbpa.com`; run as site user `cetechtraining`. Prefer a temporary `wp eval-file` that prints labels only.
2. Staging wp-admin screens (screenshot, redact).
3. Authenticated Woo REST GET using an **already-existing** credential. Do not create Application Passwords for the audit.
4. Human-supplied redacted values.

Do not SSH unrelated hosts when the operator has named the training origin. Do not `wp config list`, `cat wp-config.php`, `wp option list`, or print gateway option blobs.

Example WP-CLI (read-only):

```text
wp core version
wp eval 'echo wp_get_environment_type();'
wp option get home
wp option get siteurl
wp plugin list --fields=name,status,version --format=table
wp theme list --fields=name,status,version --format=table
```

Woo (verify current option names against the installed WooCommerce runtime before relying on them):

```text
wp option get woocommerce_manage_stock
wp option get woocommerce_hold_stock_minutes
wp option get woocommerce_currency
wp option get woocommerce_price_num_decimals
```

HPOS: WooCommerce → Settings → Advanced → Features, or the official `OrderUtil` read API for that Woo version. Do not toggle HPOS. Do not hard-code option names from memory.

Stop if credentials would have to be pasted into git/chat.

## Phase 3 — staging isolation gate

Do not start Phase 4 until **all** of the following are evidenced, or explicitly waived by senior review with residual risk recorded:

- WP environment type is staging on the audited host.
- Staging URL ≠ production URL.
- Database/service fingerprints differ from production (record “fingerprints differ”, not connection strings).
- Woo/VitePOS on staging cannot write production stock.
- Payment gateways are disabled or genuine test/sandbox mode (no live settlement).
- Production webhooks, fulfillment, and customer email/SMS are not driven by staging events.
- Customer dataset is sanitized or the remaining PII risk is accepted in writing.

If production comparison is unavailable, record `BLOCKED — production comparison required` and **do not** perform write tests.

Conclusion language:

- `SAFE FOR CONTROLLED STAGING WRITE TEST` — only when the gate is actually met.
- Otherwise `NOT PROVEN` or `UNSAFE`.

## Phase 4 — transactional tests (forbidden until Phase 3 passes)

Only after the isolation conclusion is `SAFE FOR CONTROLLED STAGING WRITE TEST` **and** a later task explicitly authorizes it:

- one controlled staging checkout / VitePOS sale / stock observation
- still no production credentials
- still no live settlement

CP-04 itself does not authorize Phase 4.

## Evidence output

Update:

- `docs/integration/evidence/CP-04-LIVE-AUDIT.md`
- `docs/integration/evidence/CP-04-AUTHENTICATED-AUDIT.md`
- `LIVE-ENVIRONMENT-FACTS.md`
- WS3 `STATUS.md` / `HANDOFF.md`

Timestamp every upgrade of a cell. Do not mark CP-04 complete while isolation remains `NOT PROVEN` / `UNSAFE`, even if HPOS and Woo stock options are now verified.
