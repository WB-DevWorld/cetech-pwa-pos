# R4 cross-cart quote isolation — start freshness

NEW ADR-012 continuation. Not Pass 3 of `R4-REVIEW-REMEDIATION-FRESHNESS.md`.

UTC: `2026-09-13T23:03:25Z`

Fetch: `git fetch origin --prune` succeeded from `C:\Users\Jane\Desktop\Learning 2026\Cursor\cetech-pwa-pos-r4-pr41`.

| Field | Exact value |
| --- | --- |
| origin/main | `516d6a49af74cc6677f67bdf843de6e819a05feb` (R3 merge; no newer main) |
| PR #41 origin/local head | `9703b275e16e3f333756e23c5fd1b23b74d5493c` |
| Independent review | @Emmanuel-coder-prog **CHANGES_REQUESTED** on that exact SHA at `2026-09-13T22:53:38Z` |
| Newer independent review | none |
| Required CI on `9703b27…` | pull_request run 34787664296 success; push run 34787662560 success |
| Unexpected branch movement | none |
| Issue #4 | OPEN |
| R5 | not started |

Emmanuel accepted the prior three remediations (Sell init, live `changed`, catalog cursor) and requested one remaining HIGH: remote quote state must be isolated by cart identity across New Sale.

Scope: `useCartQuote` applicability and stale-response suppression by `(cartId, cartRevision)`. PRE-R5 hardening remains deferred.
