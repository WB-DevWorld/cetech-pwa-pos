# ADMIN #105 screen and capability matrix

Evidence for the final source candidate on `ws3/admin-105-control-plane` / PR #109.
This is a source classification. It is not authenticated staging acceptance and not production approval.

Starting remote head for this remediation: `b5e70f6edd338428cc5e079db85ec4da45879645`.
The branch had not advanced past that SHA before these edits.

Shared staging still has no persistent Owner/Admin/Support membership from this task.
`20260922123000_pos_admin_control_plane.sql` is already applied on CETECH POS staging.
`20260923140000_pos_admin_topology.sql` is a forward migration and was not applied to shared staging or production.

## Status key

1. Production functional
2. Production functional but intentionally read-only
3. Production functional with documented bounded limitation
4. Implemented backend but not fully composed into runtime
5. Partially functional
6. Dead/unreachable
7. Placeholder/mock/demo
8. Explicitly deferred post-P0

| Surface | Reachable | Real data | Mutations work | Role | Mobile | Placeholder? | Limitation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Staff sign-in | Yes | Session cookie | Sign-in | All assigned staff | Yes | No | Staging Owner still needs the controlled bootstrap | 3 |
| Logout / session expiry | Yes | Session store | Revoke | Signed-in staff | Yes | No | | 1 |
| Forced password change | Yes | Auth `app_metadata.must_change_password` plus session flag | Password replace, then session revoke | Direct-created or reset staff | Yes | No | User must sign in again after the change. Route changes stay on the password screen. | 3 |
| Sell | Yes | Catalog, quote, prepare | Cart and checkout | Cashier/manager in scope | Yes | No | Frontend is not pricing authority | 1 |
| Search / barcode / variation | Yes | Product read model | Add to cart | Cashier | Yes | No | Camera scan is post-P0 | 3 |
| Cart | Yes | Quote | Quantity and lines | Cashier | Yes | No | Compact names are visually clamped to two lines | 1 |
| Cash payment | Yes | Payment and sales ports | Tender | Cashier | Yes | No | | 1 |
| Mobile Money | Yes, when configured | Server method capability | Initialize only if configured | Cashier | Yes | No | Requires valid Paystack test configuration **and** explicit server `PAYSTACK_MOBILE_MONEY_ENABLED=true`. Provider presence alone does not enable it. | 3 |
| Card | Yes, when configured | Same capability source | Initialize only if configured | Cashier | Yes | No | Requires valid Paystack test configuration **and** explicit server `PAYSTACK_CARD_ENABLED=true`. It is independent of Mobile Money. | 3 |
| External terminal | Shown disabled | Capability stays unconfigured | No | Cashier | Yes | No | Not inferred from Paystack | 3 |
| Payment recovery | Yes | Existing payment truth | Resolve, no second charge | Cashier | Yes | No | | 1 |
| Receipt / reprint | Yes | Immutable receipt | Print | Cashier | Yes | No | Not a Ghana e-VAT invoice | 3 |
| Orders / detail | Yes | Order read model | Reprint and start return | Cashier | Yes | No | Customer account id is under Reference | 1 |
| Returns | Yes | Return flow | Preview, approval, execute | Cashier; manager approves | Yes | No | Approval does not refund or restock by itself | 1 |
| Register / shift / X / Z | Yes | Shift records | Open, close, variance | Policy-scoped | Yes | No | | 1 |
| Attention | Yes | Recovery records | Check existing work | Cashier | Yes | No | Cashier wording, no command vocabulary | 1 |
| Settings | Yes | Device/register/scanner/print/appearance | Local device settings | Signed-in staff | Yes | No | One Settings control in the DOM | 1 |
| System status | Yes | Health plus payment capabilities | Safe checks only | Staff; richer detail in Management | Yes | No | Technical detail stays on the management diagnostic screen | 2 |
| Offline / passive tab / update-ready | Yes | PWA lifecycle | Controlled update | Cashier | Yes | No | Does not clear unsynced work | 1 |
| Management overview | Yes | Context summary | Navigation only | Owner, admin, manager, support | Yes | No | | 2 |
| Staff & access | Yes | Staff directory | Add, invite, roles, locations, registers, POS access, temporary password | Owner/admin; manager register-only in scope | Yes | No | Auth user lookup is bounded. Last sign-in is not shown. Resend is the existing invite path. | 3 |
| Locations | Yes | `pos_locations` | Create, rename, activate/deactivate | Owner/admin | Yes | No | No physical delete. Staging needs the forward migration before runtime use. | 3 |
| Registers | Yes | `pos_registers` | Create, rename, status | Owner/admin | Yes | No | Currency and location stay fixed after creation | 3 |
| Devices | Yes | `pos_devices` | Create, rename, move location, activate/deactivate | Owner/admin | Yes | No | Location-scoped. No invented register binding | 3 |
| Shifts & cash | Yes | Shift aggregates | Exact cash-entry reversal where supported | Manager in scope; owner/admin read | Yes | No | Arbitrary cashier pay-in/pay-out is post-P0 | 3 |
| Returns & approvals | Yes | Return attention | Approval and refund check | Manager at the location | Yes | No | Mutations are real but bounded: approval does not itself refund or restock. | 3 |
| Operational rules | Yes | Policy layers | Save override at selected scope | Owner/admin; manager at managed locations | Yes | No | Server resolves inheritance | 1 |
| Receipt settings | Yes | Location receipt settings | Save | Owner/admin | Yes | No | Does not rewrite historical receipts | 1 |
| Management system status | Yes | Same health and payment capability | Observation | Owner, admin, manager, support | Yes | No | | 2 |
| Activity / audit | Yes | Append-only audit | None | Owner, admin, support; manager sees managed locations | Yes | No | Raw ids stay under Reference | 2 |

## Not composed, deferred, or retired

| Item | Classification |
| --- | --- |
| First staging Owner | Not created. See `docs/runbooks/ADMIN-105-FIRST-OWNER-BOOTSTRAP.md`. No public bootstrap route. |
| `FixAppPanel` | Unmounted. Superseded by the saved-work recovery panel. Not a cashier action. |
| `LocalDataMigrationPanel` | Unmounted. Superseded by the same saved-work recovery path. |
| Split tender, loyalty, camera scan, ESC/POS hardware, cashier customer creation, arbitrary pay-in/pay-out, inventory admin, hold/resume, AccessLobby, MoneyMove | Post-P0. No production control claims they are available. |
| Live authenticated role matrix | Requires later Exact SHA Preview after fresh Ben review. Mocked tests are not that acceptance. |

## Settings duplication

Cause: `PrimaryNav` and `.sidebar-bottom` each rendered Settings. CSS hid one by viewport, so both stayed in the DOM.
Fix: one `button.nav-btn[data-route="settings"]` inside primary navigation, placed with layout rather than a second control.
Proof: `AppShell.test.tsx` expects one match, and `tests/frontend/visual/shell-viewports.pw.ts` expects count 1 at desktop, tablet, and 390×844.
