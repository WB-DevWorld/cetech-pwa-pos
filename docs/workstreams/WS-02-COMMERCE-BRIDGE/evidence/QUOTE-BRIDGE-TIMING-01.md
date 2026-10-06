# QUOTE-BRIDGE-TIMING-01

SOURCE-ONLY diagnostic. Default off. No commercial optimization and no speed claim.

Acting implementer: @wbdevworld / WS3. Original bridge owner: @Emmanuel-coder-prog / WS2. Authority: owner instruction 2026-10-05T23:28:29Z, "stop implementation... let ws3 do all implementations". Independent review is pending. No review request was sent. This commit does not self-approve.

## Baseline

Parent: `origin/integration/r9-staff-remediation-final` `1021cd113c783e25030fe9c0bda1be9ddcf5888c`. Bridge tree at that parent: `9aaa031e4d1342cdb729cfdfb5373cd57ad2ca02`.

That parent was selected because it is the declared integration baseline and its bridge tree is the reviewed shared subtree. Protected main `c49045dd02c46574af5d341cc65c177116fa7306` has a different bridge tree. Candidate #140 `0e383d84f11573ca89d6533c8cb7c35d79d7b261` (application tree `0983f05a0bdcdb365a350859a07188a23b229064`) was not imported. #139 and #140 stay on their own branches.

The published commit SHA is the commit that contains this file. It is copied into the PR handoff after the commit exists.

## What the patch does

`Cetech_Pos_Bridge_Quote_Timing` is request-local. The controller creates it only when `CETECH_POS_QUOTE_TIMING_ENABLED === true` and `CETECH_POS_QUOTE_TIMING_CORRELATION_ID` is one valid UUID. The request correlation must match that UUID with `hash_equals`. A disabled gate does not construct a recorder and does not read the clock, query counter, or log. No browser header or query parameter enables it.

The recorder is an optional second argument to `quote()`. Prepare and nested quotes keep the one-argument call. The engine does not store it. Snapshot stays outside the restore `try`. A snapshot throw does not restore. Restore keeps a diagnostic-only nested `finally` so its timer closes without replacing the business exception.

Outcomes are `success`, `typed_error`, `engine_aborted`, and `incomplete`. `success` is recorded only after the existing response has been constructed. At most one JSON object is written with `error_log`, and only if it is at most 2048 bytes and contains the fixed allowlist. Invalid telemetry is dropped, not truncated. Clock failures use no `microtime` substitute.

## Verification

Commands used Git's `sh` because this Windows GNU make otherwise runs the POSIX Makefile recipe under `cmd.exe`. The exact `make -C wordpress/cetech-pos-bridge …` invocation without `SHELL` failed in that environment. The successful form is below. PHP CLI was 8.5.0. That is not the training PHP-FPM runtime.

```text
make SHELL=C:/PROGRA~1/Git/usr/bin/sh.exe -C wordpress/cetech-pos-bridge check
exit 0
make SHELL=C:/PROGRA~1/Git/usr/bin/sh.exe -C wordpress/cetech-pos-bridge test
2913 passed, 0 failed, exit 0
make SHELL=C:/PROGRA~1/Git/usr/bin/sh.exe -C wordpress/cetech-pos-bridge parity
138 passed, 0 failed, 19 skipped, exit 0
python scripts/verify_control_plane.py
PASS, exit 0
```

`python3` is not on PATH. `python` is Python 3.14.4 and ran the same script.

Parity skips stay skips. They are `LIVE_TRAINING_CAPTURE` or `NOT_APPLICABLE_WITH_EVIDENCE`. `pricingParityVerified` remains false. Synthetic fixtures are not live pricing parity.

Forced normalize throws still emit the existing abort line `cetech-pos-bridge quote aborted: Error @ class-money.php:17`. That line is the pre-existing abort log, not the new timing event.

Instrumentation overhead, TEST-ONLY, 21 paired isolated synthetic guest quotes on PHP CLI:

```text
QUOTE_TIMING_OVERHEAD samples=21 disabled_us_min=175 disabled_us_p50=188 disabled_us_max=336 enabled_us_min=199 enabled_us_p50=206 enabled_us_max=459 delta_us_min=-39 delta_us_p50=25 delta_us_max=209 extra_queries=0
```

Extra accounted query delta was 0. Order, stock, and payment counts stayed 0. This measures diagnostic cost on the fake runtime. It is not a cashier-speed result. The negative minimum is timer noise.

## Sanitized event shape

TEST-ONLY schema illustration. Not a training capture. Unentered phases and invalid counters are omitted rather than shown as zero.

```json
{
  "event": "cetech_pos_quote_timing",
  "version": 1,
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "outcome": "success",
  "controller_ms": 6,
  "context_ms": 1,
  "pricing_ms": 1,
  "result_ms": 1,
  "restore_ms": 1,
  "controller_query_delta": 0,
  "context_query_delta": 0,
  "pricing_query_delta": 0,
  "result_query_delta": 0,
  "restore_query_delta": 0
}
```

The event allows only that fixed name, version, the selected UUID, the four outcomes, finite nonnegative millisecond fields, and nonnegative integer query deltas. It does not carry cart, customer, price, tax, payment, cookie, error text, or source paths.

The four 1 ms groups are an illustration, not a measurement. `controller_ms` is 6 so it can contain those groups. The remaining 2 ms is unallocated diagnostic and transition time. Group sums do not have to equal the controller total.

## Diff against the manifest

Changed paths are the ten allowlisted paths: seven source/test/build files, this evidence file, the scope JSON, and `CURRENT-WORK.md`. No schema, version header, migration, BFF, index, cache, pool, or hook change.

## Qualification QUOTE-BRIDGE-TIMING-01-QUAL

Reviewed source `baaa8ac458689180a5a4bb0b5f8b3607829aac1f`. Application tree `3ea4a2c7930b50a7ccb5ab5f0c0478347abd95dd`. Bridge tree `21c8660b3e74c17d9e9631d264499d140d6b159d`. Start `2026-10-06T01:08:11Z`: `origin/main` `c49045dd02c46574af5d341cc65c177116fa7306`, `origin/integration/r9-staff-remediation-final` `1021cd113c783e25030fe9c0bda1be9ddcf5888c`. This qualification has its own two freshness observations after its commit. The closed cutoffs `2026-10-06T00:36:54Z` and `2026-10-05T23:01:40Z` stay closed.

The AI review of #141 is not human approval. Independent human review of the resulting head remains PENDING. Preferred reviewer: @Emmanuel-coder-prog. No notification was sent.

Two paired cases were added in `tests/bridge/test-quote.php`. No source defect appeared, so the controller, engine, and helper were not edited.

| Pair | Timed side | Untimed control | Result |
| --- | --- | --- | --- |
| Restore after successful pricing and store | Accepted recorder whose log sink throws | Same restore failure, no recorder | Both engines throw `RuntimeException` `restore SECRET_EXCEPTION_TOKEN`. Finish does not escape. Both controllers return HTTP 503 `INTEGRATION_UNAVAILABLE` with the same error object. One restore, one store write, matching call order, zero orders/stock/payments. The response does not carry the diagnostic or restore text. |
| Calculate and restore both throw | Accepted recorder whose clock throws | Same both-throw failure, no recorder | Restore's `RuntimeException` keeps precedence over the calculate failure and over the clock failure. Both controllers return the same HTTP 503 mapping. One restore, zero store writes, matching call order, zero orders/stock/payments. The event does not claim success. |

These are synthetic failure qualifications. They are not a production defect and not a live timing sample.

Qualification command results are recorded after the four commands below. The published qualification SHA is the commit that contains this section. It is copied into the PR handoff after the commit exists.

```text
make SHELL=C:/PROGRA~1/Git/usr/bin/sh.exe -C wordpress/cetech-pos-bridge check
exit 0
make SHELL=C:/PROGRA~1/Git/usr/bin/sh.exe -C wordpress/cetech-pos-bridge test
2961 passed, 0 failed, exit 0
make SHELL=C:/PROGRA~1/Git/usr/bin/sh.exe -C wordpress/cetech-pos-bridge parity
138 passed, 0 failed, 19 skipped, exit 0
python scripts/verify_control_plane.py
PASS, exit 0
```

The earlier 2913 count is the reviewed source `baaa8ac` before these pairs. Parity skips remain `LIVE_TRAINING_CAPTURE` or `NOT_APPLICABLE_WITH_EVIDENCE`. `pricingParityVerified` remains false. Control-plane PASS is the foundation check only.

## Training runtime plan — prepare only, not authorized

This batch does not install files, edit configuration, restart a service, flush a cache, or POST a quote. Runtime authorization remains NONE. The slots marked UNVERIFIED were not read in this batch. Earlier user-reported training facts are labeled that way and are not a new measurement. Disk header `0.6.0-stg05` is not loaded-generation proof.

### Pending gates

| Gate | State |
| --- | --- |
| Final source SHA | The qualification commit, recorded in the PR after it exists. Pin that SHA and the four blobs below. Do not deploy a moving branch. |
| Independent human review of that exact head | PENDING |
| Installed training plugin tree, config, and backup identity | UNVERIFIED in this batch. Before any later write, read the installed plugin and the two constant definitions, stop on drift, and keep an immutable backup of the three existing files plus the exact `wp-config.php` constant region. |
| Training PHP-FPM version, pool, opcode cache, and a supported loaded-code transition | UNVERIFIED in this batch. USER-REPORTED earlier: dedicated ondemand pool, PHP-FPM 8.5.9, CLI 8.4.24 is not the web runtime. A CLI test, disk hash, or CLI cache reset is not FPM proof. No shared or production pool operation is included. |
| Current BFF deployment | UNVERIFIED in this batch. Historical tester URL, until the runtime task reverifies it: `https://cetech-pos-staging-git-integration-9578df-wbdevworlds-projects.vercel.app`. Historical deployment `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6` / source `816e0bb6963aff760609a3c7e4817e603c4ffdf0` is not this candidate. The automatic #141 preview is not the training bridge. |
| Named customer, location, cart, lines, currency | UNVERIFIED. Do not invent them. The runtime task must name one existing training customer and context, one location, cart identity and revision, exact products, variations, quantities, and currency before any request is approved. |
| One new correlation UUID | Chosen at authorization. Do not reuse `954d1875-333a-4adb-b1c2-5b4374925b03`. |

### Caller

One non-interactive HTTP POST to `/api/pos/v1/quotes` on the reverified current BFF deployment. One call. Valid existing staff session, CSRF, and origin for that deployment. The approved UUID is the only `X-Correlation-ID`. Direct Woo POST is a different experiment and is not this plan. Do not use the sell UI, a coalesced follower, a second quote, prepare, pay, tender, finalize, order, stock, refund, or load.

### Cutover

The new bootstrap always requires `includes/class-quote-timing.php`, including while the gate is off. Replacing files one by one is not a four-file release. The runtime task must use one supported training mechanism after read-only discovery: either a staged complete plugin generation with a supported directory cutover, or an owner-approved request drain that covers every request loading this plugin. Stage and syntax-check all four files with a PHP compatible with the training FPM version before exposure. Keep the gate off during that cutover. Qualify the loaded generation in that FPM pool. A read-only generation check must be named in the runtime manifest and must not add a second quote POST.

Proposed installed paths, relative to site root `/home/cetechtraining/htdocs/training.cetechbpa.com`, SSH profile `cetechtrainingappserver`:

| File | Blob |
| --- | --- |
| `wp-content/plugins/cetech-pos-bridge/cetech-pos-bridge.php` | `38bca46ec6026c961b53116331736aa35aa2e5a5` |
| `wp-content/plugins/cetech-pos-bridge/includes/class-quote-controller.php` | `466ca0acf5742d9b5d6550fb9f8d7a707b509c82` |
| `wp-content/plugins/cetech-pos-bridge/includes/class-quote-engine.php` | `3711fc048015a8c466a8c526783345996835a7fa` |
| `wp-content/plugins/cetech-pos-bridge/includes/class-quote-timing.php` | `66e9f4407b2f6429f4f5cc7731ad0f75d0c82a94` |

### One attempt and cleanup

After loaded-code qualification with the gate off, set only `CETECH_POS_QUOTE_TIMING_ENABLED` to `true` and `CETECH_POS_QUOTE_TIMING_CORRELATION_ID` to the approved UUID. Qualify that configuration in PHP-FPM. Submit the one request with a 60-second client deadline and zero automatic retries. The gate has no TTL and is not one-shot across requests.

On success, typed error, abort, missing telemetry, timeout, or interruption: stop further callers first, then turn both constants off, then qualify gate-off for future requests. A client timeout does not stop PHP. Leave the helper in place while the outstanding request may still be executing. Do not send another quote to improve the trace. A cleanup failure stops the experiment and must be reported as an uncertain gate or worker state.

### Rollback

Disable future gate activation, account for the in-flight request, and restore one previous consistent generation under the same cutover and cache procedure. Remove the helper only after no executing or newly loaded bootstrap requires it. If a helper already existed, restore that file. Do not overwrite unrelated `wp-config.php` edits. Leave the normal Woo quote transient and Supabase `pos_quote_snapshots` row unless a separate data decision removes them.

### Runtime impact manifest

| Item | Bound |
| --- | --- |
| Installed paths | The four plugin files above, plus the two PHP constants in training `wp-config.php` |
| Service and cache | Only the training-pool loaded-code transition the runtime task names after discovery. No production or shared pool. |
| Request | One BFF quote POST, as specified above |
| Normal writes | One Woo quote transient and one Supabase quote snapshot |
| Evidence reads | The one timing line for that UUID in the existing PHP error log, and the matching BFF `quote_request_timing` bridge stage if accessible |
| Cleanup | Gate off and qualified in FPM, on every outcome |
| Retention | Existing host retention. No new sink. |
| Rollback | Previous generation, helper removed only when safe |
| Final state | Gate off. Plugin generation is whatever the runtime task approves, recorded explicitly. |
| Forbidden | Schema, migration, index, order, stock, payment, refund, Delivery Engine, theme, production |

`controller_ms` is entered native quote time. It does not measure the anonymous pre-controller denial or bootstrap and queue time before the controller. `bridge_ms - controller_ms` is unallocated. One sample is not a percentile or a capacity result. #115 and #132 stay open.

## Boundaries

No schema change. No runtime write was performed. Staff documentation impact: NONE. Issues #115 and #132 stay open. Verdict: NOT READY FOR PRODUCTION. Production effects: NONE.
