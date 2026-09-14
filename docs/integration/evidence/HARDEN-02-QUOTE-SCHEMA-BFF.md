# HARDEN-02 QuoteRequest/Quote BFF schema

PRE-R5 HARDENING for GitHub issue #47. Not R5 feature work. Not BR-06/CORE-05.

Shared `CURRENT-WORK.md`, WS3 `STATUS.md`, and WS3 `HANDOFF.md` were **not** edited (parallel #46 / integration-editor coordination). This file is the task-specific evidence and handoff.

## Provenance

| Field | Exact value |
| --- | --- |
| Task | HARDEN-02 / issue #47 |
| Workstream / owner | WS3 / @wbdevworld |
| Acting human / mode | @wbdevworld / IMPLEMENT |
| Contributor branch | `ws3/pre-r5-quote-schema-bff` |
| Starting/base SHA | `29cea52acbee2729175df61d2ae1a6658c5c04b1` (`origin/main`, required #47 baseline) |
| Pre-handoff implementation SHA | `0034f3dacdc00bb365324df2a3882cb857fbf5f6` |
| Contracts changed | none (v1.0.0 consumed; frozen QuoteRequest/Quote shapes/versions unchanged) |
| Database migrations | none |
| Architecture decisions | none |
| Forbidden paths touched | none (`wordpress/cetech-pos-bridge/**` untouched; WS1 UI untouched) |
| Reassignment | NONE |
| Issue #4 | OPEN |
| `pricingParityVerified` | false |
| R5 / BR-06 / CORE-05 | not started |
| PR #51 / `batch/pre-r5-hardening` | not imported by this task |

## Allowed / forbidden

Allowed: `apps/pos-web/src/app/api/pos/v1/quotes/**` (unchanged route; handler consumed), `apps/pos-web/src/server/quotes/**`, `tests/contracts/**`, relevant server tests, task-specific evidence.

Forbidden observed: no v1 schema shape/version edit; no WS1 feature/UI; no WS2 bridge; no lockfile/dependency add; no CURRENT-WORK/STATUS/HANDOFF edit.

## Behavior

`handleQuote` now:

1. Validates inbound bodies against canonical `QuoteRequest` (`docs/contracts/pos-domain.schema.json`) **before** `bridge.postQuote`.
2. Validates `result.data` against canonical `Quote` **before** returning 200 to frontend consumers.
3. Preserves existing messages/codes: invalid request → `VALIDATION_ERROR` / `"QuoteRequest is invalid"` / 400; invalid quote → `INTEGRATION_UNAVAILABLE` / `"quote bridge returned an invalid Quote"` / 503; typed bridge failures such as `QUOTE_CHANGED` still pass through; correlation ID is echoed.

The evaluator loads the frozen schema file and applies the same keyword subset as `scripts/verify_control_plane.py` (`$ref`, `type`, `properties`, `required`, `additionalProperties`, `items`, min/max, `pattern`, `enum`, `const`, `oneOf`). It is not a handwritten duplicate QuoteRequest/Quote contract. TypeScript types are not used as runtime validation.

## Files changed (implementation commit `0034f3da…`)

- `apps/pos-web/src/server/quotes/canonical-schema.ts` (added)
- `apps/pos-web/src/server/quotes/canonical-schema.test.ts` (added)
- `apps/pos-web/src/server/quotes/handle-quote.ts` (modified)
- `apps/pos-web/src/server/quote.test.ts` (modified)
- `tests/contracts/fixtures.json` (added QuoteRequest/Quote positive and negative fixtures; 22 → 32)
- `docs/integration/evidence/HARDEN-02-QUOTE-SCHEMA-BFF-START-FRESHNESS.md` (added)

`apps/pos-web/src/app/api/pos/v1/quotes/route.ts` and `compose-quote-bridge.ts` unchanged: the route already delegates to `handleQuote`, which is the trusted boundary.

## Tests executed (Windows, Node v24.21.0, pnpm 12.4.1, Python 3.14.4)

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | EXIT 0 (61 schemas, **32** contract fixtures) |
| `pnpm --dir apps/pos-web lint` | EXIT 0 |
| `pnpm --dir apps/pos-web typecheck` | EXIT 0 |
| `pnpm --dir apps/pos-web test` | EXIT 0 (**43 files / 308 tests**) |
| `git diff --check` | EXIT 0 |

Relevant coverage:

- Control-plane fixtures now include valid walk-in Quote, valid B2B QuoteRequest, missing required, wrong nested quantity type, invalid quantity, extra line `unitPrice`, empty Quote lines, negative money, invalid `stockStatus`, extra Quote property.
- `canonical-schema.test.ts` asserts the evaluator agrees with **every** `tests/contracts/fixtures.json` row and that QuoteRequest/Quote `additionalProperties` come from the canonical file.
- `quote.test.ts` proves valid walk-in / retail / B2B requests still return 200 with totals unchanged; invalid requests never invoke the bridge (`VALIDATION_ERROR`); invalid Quotes never reach the caller (`INTEGRATION_UNAVAILABLE`); `QUOTE_CHANGED` still passes through with the request correlation ID.

## Freshness

See `HARDEN-02-QUOTE-SCHEMA-BFF-FRESHNESS.md`. **FRESH_2**. Both main cutoffs `29cea52acbee2729175df61d2ae1a6658c5c04b1`. Pass 2 UTC `2026-09-14T01:18:56Z`. Pass 3 not permitted.

Peer `origin/ws3/pre-r5-catalog-query-index` `7f41a29b4e706aafe93d2047b701f1e260488f86` (HARDEN-01 catalog/local only) classified **IRRELEVANT** / not consumed. `origin/batch/pre-r5-hardening` `864e68a36c3bc3a32f571f57ecd73da14d77d7af` classified **IRRELEVANT** / not imported.

## Integration editor follow-up (do not do this on the contributor branch)

Record in shared WS3 STATUS/HANDOFF and CURRENT-WORK after import:

- HARDEN-02 / #47 IMPLEMENT complete on `ws3/pre-r5-quote-schema-bff`.
- Source SHA: this branch’s published head (implementation `0034f3dacdc00bb365324df2a3882cb857fbf5f6` plus the evidence commit on top).
- Import with `git cherry-pick -x` into `batch/pre-r5-hardening`; record imported SHA and tested combined SHA.
- Do not treat this as R5 activation. Do not take #48 / WS2 bridge schema work.

## Limits

- Runtime JSON Schema coverage is the repository’s frozen v1 subset, not a third-party draft-2020-12 engine. Adding Ajv remains CORE-06 / later if separately authorized.
- Live Woo/bridge quote traffic was not re-run; R4 valid walk-in/retail/B2B shapes are proven in unit tests against the canonical schema.
- No production promotion. No `pricingParityVerified=true`.
