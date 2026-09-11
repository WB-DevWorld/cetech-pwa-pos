# CETECH POS — Screen & State Matrix

Legend: **Built** = directly interactive in preview; **Represented** = reachable through Demo Controls / scenario state; **Production hook** = UI/state semantics exist but production provider work replaces the mock.

| Screen / component | Normal | Loading | Empty | Success | Error | Offline | Degraded | Permission denied | Needs attention | Mobile | Tablet | Desktop |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Login / authentication | Built | Represented | n/a | Built | Represented | cached shell concept | n/a | Built | Locked register built | Full | Full | Full |
| Sell / product results | Built | Inline search/quote | Built | n/a | product not found built | Built | stale catalog/pricing outage | passive tab | critical recovery blocks Pay | phone-specific | split | split |
| Product search | Built | Inline | no matches | selection | local error concept | Built from cached data | stale projection | n/a | collision | Full width | Left pane | Left pane |
| Barcode scanner | Built keyboard wedge + demo buttons | immediate | unknown barcode | repeated scan | collision modal | Built local | stale stock advisory | passive tab blocks mutation | n/a | Supported | Supported | Supported |
| Variation selector | Built | n/a | n/a | exact selection | unavailable variation concept | Built local | stale advisory | n/a | n/a | sheet | dialog | dialog |
| Cart | Built | quote inline | Built | confirmed quote | invalid line | Saved/editable | pricing unavailable | passive tab | critical recovery block | full screen | right pane | right pane |
| Customer selector | Built | production server-search hook | Walk-in default | Retail/B2B selection | search failure semantics | Walk-in remains | customer search may fail | n/a | n/a | sheet | dialog | dialog |
| Quote status | Built | `Updating price…` | missing | confirmed | failed | unavailable | stale/expired | n/a | price changed | Inline | Inline | Inline |
| Checkout preparation | Built | Preparing / Checking | n/a | Order reserved | prepare failed semantics | blocked | commerce unavailable | capability hook | Quote/Stock/ambiguous | sheet | dialog | dialog |
| Tender selection | Built | n/a | n/a | choose tender | provider unavailable | electronic blocked | cash may remain by production policy | capability hook | n/a | sheet | dialog | dialog |
| Cash payment | Built | finalizing | n/a | cash received/change | validation | checkout blocked | n/a | shift required | recovery hook | sheet | dialog | dialog |
| Electronic payment | Built | initializing/checking | n/a | verified/complete | fail/cancel | blocked | provider unavailable | capability hook | pending/reconciling | sheet | dialog | dialog |
| Receipt | Built | n/a | none | complete | print failure built — sale/receipt remain complete and reprintable | cached receipt concept | n/a | orders capability hook | n/a | readable | readable | 80mm/A4 print |
| Orders | Built | production server-search hook | Built | detail/reprint | source mismatch concept | cached recent receipt concept | provider state badges | capability hook | pending status | scroll/table adapts | table | table |
| Returns/refunds | Built | preview/execute delay | no eligible orders | complete | provider failure semantics | explicitly blocked | provider pending | manager approval represented | pending/attention | sheet | dialog | dialog |
| Register open | Built | delay | no shift | shift open | connection failure | blocked | n/a | capability hook | unresolved prior shift concept | full | full | full |
| Active register/cash | Built | movement delay | no movement | movement saved | authoritative failure | read-only concept | n/a | manager ops hook | discrepancy | full | full | full |
| X report | Built | n/a | n/a | snapshot | n/a | current cached values concept | n/a | capability hook | n/a | print | print | print |
| Shift close / variance | Built | close delay | n/a | Z report | connection failure | blocked | n/a | approval | variance preserved | sheet | dialog | dialog |
| Store Health | Built | catalog rebuild | n/a | healthy | service outages | Built | Built | manager detail hook | attention count | full | full | full |
| Needs attention / recovery | Built | Checking transaction | all clear | recovered | critical ambiguity | recovery waits | provider disagreement concept | manager action hook | core screen | full | full | full |
| Update Ready | Built | simulated apply | none | safe update | n/a | update waits | unsupported version status | n/a | blocked by critical work | sheet | dialog | dialog |
| Local-data migration | Represented | Built | n/a | complete | failure semantics | n/a | blocked by another tab | n/a | non-destructive diagnostics | sheet | dialog | dialog |
| Fix App | Built | rebuild catalog | n/a | repaired | last-resort reset | health diagnosis | partial recovery | manager hook | destructive reset blocked by critical work | sheet | dialog | dialog |
| Passive second tab | Represented | n/a | n/a | active window unaffected | n/a | n/a | passive mode | mutation denied | n/a | Built | Built | Built |
| Settings | Built | n/a | n/a | theme/device summary | n/a | readable | diagnostics | manager/admin intended | health deep link | full | 2-column | 2-column |

## Required production invariants retained by the UI

- A grey Pay button is never the only explanation; a blocking reason is shown.
- Offline never claims a completed sale.
- Pending payment never offers an automatic duplicate charge.
- Price/stock changes return the cashier to review before payment.
- A receipt is not treated as the statutory Ghana invoice unless an approved compliance integration produces one.
- A returned item is not automatically restocked merely because money was refunded.
- A variance is never altered to make expected cash equal counted cash.
- Critical recovery is resolved before another risky transaction is started.
