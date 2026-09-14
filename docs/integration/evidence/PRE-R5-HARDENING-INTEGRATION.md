# PRE-R5 hardening — combined integration evidence

Integration issue: #49. Draft PR: #51. Branch: `batch/pre-r5-hardening`. Base main: `29cea52acbee2729175df61d2ae1a6658c5c04b1`. Integration editor: `@wbdevworld` / WS3.

This is PRE-R5 hardening only. It does not activate BR-06, CORE-05 or R5. Issue #4 remains OPEN; `pricingParityVerified=false`; production is untouched.

## Accepted contributions

### HARDEN-01 / #46 — local catalog query/index
Source implementation `1199a344a3d2bf4d24b0322ca29f04ad6711cb63`; source head `7f41a29b4e706aafe93d2047b701f1e260488f86`. Imported as `c689c108bfd4dbe325c08aa137d47cfe66966b2e` plus evidence `d927faa18fff3babc236af54e2c696a09c9946c1`.

Normal catalog search/scan no longer reloads every Dexie catalog row or reconstructs `CatalogProjectionEngine` per request. Indexed candidates use barcode, parent, primary-key/id cursor and v4 `*searchGrams`, with R4 final-match semantics retained. The v3->v4 upgrade backfills the rebuildable projection index without clearing cart drafts or journal. Contributor evidence includes the >=5,000-item adapter benchmark and 44 files / 247 tests PASS.

### HARDEN-02 / #47 — trusted BFF quote schema
Source implementation `0034f3dacdc00bb365324df2a3882cb857fbf5f6`; source head `4816cfa264d60763207aadae192a6623ff293302`. Imported as `914a5458a7b6ef5aea11c7e99e5d8b891ec98932` plus evidence `93de9dc78abb146696c7d74d96bc159ef3d051bf`.

The BFF validates canonical frozen-v1 `QuoteRequest` before the bridge and canonical `Quote` before returning a success. Invalid ingress is `VALIDATION_ERROR` / 400 and never reaches the bridge; invalid egress is `INTEGRATION_UNAVAILABLE` / 503. Typed failures and correlation semantics remain intact. Contributor evidence: verifier PASS with 32 fixtures and 43 files / 308 tests PASS.

### HARDEN-03 / #48 — Woo bridge quote schema
Owner / implementer: `@Emmanuel-coder-prog` / WS2. Source implementation `c06c9e67108d372e25e815a43e05029ba12e6ab5`; initial evidence `2da3dc4f3e15d8d8da12c9f732296f25f4528bea`; source head `b7fd95e6430748a261cb6e4da45f06c3411c91c2`. Imported as `1628f40a7bdb8bc8df5f40dc07267c68a5ed06bd`, `d589d05f655a7f1e53101a86a764f4b52a5565f8`, and `8647c2d63e0b9f73324292362250b7aa908645fb`.

Independent integration review found no scope/correctness blocker. The bridge ships a deterministic transitive `$defs` projection derived from `docs/contracts/pos-domain.schema.json`; the derivation rejects unsupported keywords and the runtime validator contains no duplicated QuoteRequest/Quote field lists. Invalid ingress fails before any Woo pricing entry point. Produced Quotes are validated after authoritative Woo pricing/normalization and before store/success return. No Woo/WoodMart/B2BKing pricing formula or ADR-013 allocation was changed.

Exact source verification: GNU Make check PASS; bridge test **445/0**; parity **138/0/19 permission-required-skipped**; canonical artifact `--check` PASS; source-head CI run `34825258023` SUCCESS.

## Combined verification

Combined contribution head before this ledger finalization: `8647c2d63e0b9f73324292362250b7aa908645fb`.

GitHub Actions run `34827412680` is SUCCESS on both required jobs. Linux passed foundation/contracts, tooling, local Supabase reset, pgTAP, lint, typecheck, unit tests, production build, Playwright install and E2E. Windows passed foundation/contracts, tooling, lint, typecheck, unit tests and production build.

The repository CI workflow does not execute the WordPress bridge Make targets. Therefore this evidence does **not** invent a separate combined-head Make run. HARDEN-03 was imported from the exact source-tested bridge blobs; HARDEN-01/02 do not edit the bridge subtree. Source canonical Make evidence remains the bridge component proof, while the combined GitHub run proves repository/app/control-plane compatibility.

## Contract and safety invariants

Frozen v1 contracts remain unchanged. No PRE-R5 Supabase migration. Catalog remains a rebuildable projection, not inventory truth. Drafts/journal are preserved. No sale preparation/finalization, payment, order or stock mutation. No production promotion. `pricingParityVerified` remains false.

## Remaining gate

This evidence commit/ledger finalization must receive exact-head required CI. After that, run exactly two NEW ADR-012 final freshness observations against main, batch and contributor heads. No Pass 3. Do not mutate the branch after Pass 1. If FRESH_2, mark PR #51 ready for review and request `@Ben-001-sys` as independent reviewer. Do not merge or activate R5 without the required human review and a separate R5 activation record.
