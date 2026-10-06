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
  "controller_ms": 1,
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

## Diff against the manifest

Changed paths are the ten allowlisted paths: seven source/test/build files, this evidence file, the scope JSON, and `CURRENT-WORK.md`. No schema, version header, migration, BFF, index, cache, pool, or hook change.

## Training rollout plan — prepare only

Do not install, enable, or POST under this source batch. Runtime release is a separate authorization.

| Item | Plan |
| --- | --- |
| Host | `training.cetechbpa.com` |
| SSH profile | `cetechtrainingappserver` |
| Site root | `/home/cetechtraining/htdocs/training.cetechbpa.com` |
| Files | The installed `cetech-pos-bridge` copies of `cetech-pos-bridge.php`, `includes/class-quote-controller.php`, `includes/class-quote-engine.php`, and new `includes/class-quote-timing.php` |
| Blob hashes | `38bca46ec6026c961b53116331736aa35aa2e5a5`, `466ca0acf5742d9b5d6550fb9f8d7a707b509c82`, `3711fc048015a8c466a8c526783345996835a7fa`, `66e9f4407b2f6429f4f5cc7731ad0f75d0c82a94` in that file order |
| Backup | Copy the three existing files aside before replacement. Revert by restoring them and deleting the new helper. |
| Gate | Off unless both constants are set in server PHP. Proposed location: training `wp-config.php`. Not edited here. |
| Fixture UUID | One new UUID approved at runtime authorization. Do not reuse historical correlation `954d1875-333a-4adb-b1c2-5b4374925b03`. |
| Customer, location, cart | Still unnamed. The runtime authorization must name one existing training customer, location, and cart. |
| Credentials | Use the existing authorized training staff session. Do not copy secrets into this plan or the log. |
| Database boundary | One quote POST writes the normal Woo quote transient on training MariaDB and the normal Supabase `pos_quote_snapshots` row. No prepare, tender, payment, order, stock, refund, or second request. |
| Deadline | 60 seconds. Zero automatic retries. Request cap 1. A timeout stops the run. |
| Logs | Read the existing PHP error log for the one JSON line with the fixture UUID. Keep the host's current retention. Do not add a sink. |
| Pairing | Pair that UUID with the existing BFF `quote_request_timing` bridge stage if the log is accessible. Do not require #140's Server-Timing header. Do not pair a coalesced follower with the leader's origin event. |
| Rollback | Restore the backed-up plugin files and remove the two constants. Leave the one normal quote transient and snapshot in place unless a separate data decision removes them. |

`controller_ms` is entered native quote time. BFF `bridge_ms - controller_ms` is an unallocated interval. It is not a measured queue or bootstrap time. The anonymous pre-controller denial remains a separate investigation.

## Boundaries

No schema change. No runtime write was performed. Staff documentation impact: NONE. Issues #115 and #132 stay open. Verdict: NOT READY FOR PRODUCTION. Production effects: NONE.
