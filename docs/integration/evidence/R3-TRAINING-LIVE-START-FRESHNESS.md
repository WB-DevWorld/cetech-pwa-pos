# R3 training-live continuation — START_FRESHNESS_SNAPSHOT

NEW ADR-012 continuation. Not Pass 3 of `R3-FRESHNESS.md` or `R3-UNITPRICE-FRESHNESS.md`.

UTC: `2026-09-13T16:23:57Z`
Fetch: `git fetch origin --prune` succeeded.

| Field | Exact value |
| --- | --- |
| origin/main | `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77` |
| Editor HEAD / authorized artifact SHA | `7b593584cded9c587c135bbfe1eefb238bcbd177` |
| Plugin version | `0.2.1-br02` |
| Draft PR #44 | OPEN, `isDraft=true`, headOid `7b59358…` |
| Contracts | v1.0.0 unchanged |
| ADR-011 / ADR-012 | CURRENT / ACTIVE |
| Authorization | Training-only `https://training.cetechbpa.com` for BR-02–BR-05 live quote/parity. No production. No merge. No R4. No MailPoet reactivation. |
| `pricingParityVerified` | remains false until the complete live matrix satisfies the gate |

Canonical Make on this exact tree (WSL GNU Make 4.4.1 + Windows PHP 8.5.0 `C:\tools\php85\php.exe`):

| Command | Exit | Result |
| --- | --- | --- |
| `make -C wordpress/cetech-pos-bridge check` | 0 | PASS |
| `make -C wordpress/cetech-pos-bridge test` | 0 | **174 passed, 0 failed** |
| `make -C wordpress/cetech-pos-bridge parity` | 0 | **108 passed, 0 failed, 4 skipped** |

Make PASS is a pre-update gate, not live pricing-gate PASS.

## Pre-update recordings (required by the training authorization)

UTC `2026-09-13T16:29:37Z` on training.

| Item | Value |
| --- | --- |
| Packaged `0.2.1-br02` zip SHA-256 | `2d2cf6724f2d47cb979d347274cf8c552a59ccad7e74e139e2d5e3ec68d42780` |
| Training plugin before update | `0.1.0-br01` active; php SHA-256 `1849cf334fded93b3054681fb07ad4fce052ca5de84ff7e6d15d489baa07a013` |
| Rollback tarball | `/home/cetechtraining/backups/cetech-pos-bridge-0.1.0-br01-20260913T162937Z.tgz` |
| W1 mail containment | MU PRESENT; MailPoet inactive; `admin_email` domain `training.invalid`; mailq empty; Woo webhooks 0 |
| HPOS orders / stock sum | 51 / 5455 |
| Service identity | ID 22 subscriber; `cetech_pos_bridge_access=YES`; `manage_woocommerce=NO`; `manage_options=NO` |

Live capture after bounded `0.2.3-br02` adapter fixes: `docs/integration/evidence/R3-TRAINING-LIVE.md`.

