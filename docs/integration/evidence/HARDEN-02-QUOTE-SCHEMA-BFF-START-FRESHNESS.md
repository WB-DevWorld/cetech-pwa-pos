# HARDEN-02 QuoteRequest/Quote BFF schema — start freshness

PRE-R5 HARDENING continuation for GitHub issue #47. Not R5. Not Pass 3 of any prior session.

UTC: `2026-09-14T01:03:00Z`

Fetch: `git fetch origin --prune` succeeded from `C:\Users\Jane\Desktop\Learning 2026\Cursor\cetech-pwa-pos-harden-02`.

| Field | Exact value |
| --- | --- |
| origin/main | `29cea52acbee2729175df61d2ae1a6658c5c04b1` (WF-OWN-01 / #45; required #47 baseline) |
| Contributor branch | `ws3/pre-r5-quote-schema-bff` at the same SHA |
| Declared batch baseline | NOT_APPLICABLE (this task publishes a contributor SHA; it does not edit `batch/pre-r5-hardening`) |
| Contracts / ADRs | v1.0.0 unchanged; ADR-014 CURRENT for ownership; ADR-012 ACTIVE for two-pass freshness |
| Issue #4 | OPEN |
| `pricingParityVerified` | false |
| R5 / BR-06 / CORE-05 | not started |

Observed peers (not consumed): `origin/ws3/pre-r5-catalog-query-index` and `origin/batch/pre-r5-hardening` exist. This assignment does not import them.

Scope: make canonical existing v1 `QuoteRequest` / `Quote` JSON Schema authoritative at the trusted Next.js BFF boundary. Frozen v1 shapes/versions are not changed.
