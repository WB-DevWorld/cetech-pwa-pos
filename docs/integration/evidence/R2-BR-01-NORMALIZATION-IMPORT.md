# R2 BR-01 normalization-test import

This supersedes the Pass-1 **IRRELEVANT** classification of `130437d6…` in `R2-FRESHNESS-RUNTIME.md` for this new continuation.

UTC: 2026-09-13

START_FRESHNESS_SNAPSHOT: `docs/integration/evidence/R2-START-FRESHNESS-BR01-NORMALIZATION.md` (`2026-09-13T13:48:34Z`)

- origin/main: `aa08d74f2cb99301817e5995f01486acb7e2169f`
- R2 head before import: `b077f2da72816cfbfdef5cdeaa0c18f92a646592`
- Declared contributor implementation SHA: `130437d6d9ee1c62c5f661ffb591f41b7e49e65e` — `test(ws2): exercise bridge REST error normalization`
- Contributor evidence head **not imported**: `62608937a05648a3d6dd077012082c1c0558fe99` (WS2 STATUS/HANDOFF/evidence only; cited, not required on #43)
- Import method: `git cherry-pick -x 130437d6d9ee1c62c5f661ffb591f41b7e49e65e`
- Combined import SHA: `605e6f2bca5b1c6dfb2ba817b74f6e2dffe6ccdd`
- Conflicts: none
- Parent of imported commit vs R2 `includes/` and `tests/bridge`: **identical** (empty diff). Compatible with current R2 production bridge PHP.

## Reclassification

| SHA | Prior (runtime Pass 1) | This continuation |
| --- | --- | --- |
| `130437d6…` | IRRELEVANT (`tests/bridge/**` only; R2 already had `280a73d…`) | **COMPATIBLE / RELEVANT** — closes BR-01 negative-auth evidence gap by exercising `normalize_error_response` |
| `6260893…` | IRRELEVANT | **IRRELEVANT** for import — documentation/evidence only; provenance is the cherry-pick trailer |

Reason `130437d` is relevant to R2: PR #43 already claims combined BR-01 auth/health acceptance. The previous helper bypassed production `rest_post_dispatch` normalization. Test-only change, but it is R2 negative-auth evidence.

## Inspection of `130437d6…`

Paths:

- `tests/bridge/bootstrap.php`
- `tests/bridge/test-health.php`

Not changed by this import:

- `wordpress/cetech-pos-bridge/includes/**`
- `wordpress/cetech-pos-bridge/cetech-pos-bridge.php`
- `docs/contracts/**`
- `supabase/**`
- pricing / Woo runtime

`git diff --name-only b077f2d 605e6f2 -- wordpress/cetech-pos-bridge/includes wordpress/cetech-pos-bridge/cetech-pos-bridge.php docs/contracts supabase` → empty.

`pricingParityVerified` remains asserted `false`. Detection is not parity.

## Combined tests on import SHA `605e6f2…` (historical blocked checkpoint)

This table is the truthful record of the import continuation. It is **not** rewritten. Classification at that workstation: `BLOCKED_VERIFICATION`.

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | EXIT 0 |
| `make -C wordpress/cetech-pos-bridge check` | **BLOCKED** (`php`/`make` not on this PATH) |
| `make -C wordpress/cetech-pos-bridge test` | **BLOCKED** (same). Assertion count **UNVERIFIED** here. Prior combined R2 tree: 67 passed at `280a73d` import. New assertions added, not executed on this workstation. |
| `git diff --check` | EXIT 0 |

Do not invent PASS from that blocked workstation. GitHub `control-plane` / `control-plane-windows` on a later evidence head do not execute these Make targets.

## Exact-head Make verification (new continuation)

New START_FRESHNESS_SNAPSHOT: `docs/integration/evidence/R2-START-FRESHNESS-BR01-MAKE-VERIFY.md` (`2026-09-13T14:04:18Z`). This is not Pass 3 of the import continuation.

Tested SHA: `0deafa301411bc226e453446455a1f85d92607d7` (PR #43 review head; includes `605e6f2…` plus evidence commits `a12e55b…` / `0deafa3…`).

Environment: PHP **8.5.0**; GNU Make **4.4.1**; Python 3.14.4. No production PHP / `includes/` change in this continuation.

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | EXIT 0 |
| `make -C wordpress/cetech-pos-bridge check` | EXIT 0 (PASS) |
| `make -C wordpress/cetech-pos-bridge test` | EXIT 0 (PASS). **83 passed, 0 failed** |
| `git diff --check` | EXIT 0 |

Because both Make targets passed, no bridge code change was required. Full command log: `docs/integration/evidence/R2-BR-01-MAKE-VERIFY.md`.

## Side effects

- Production PHP changed by import: **NO**
- Contracts changed: **NO**
- Migrations from this WS2 import: **NO**
- Woo / order / stock / payment / email: **NO**
- WS2 contributor branch modified: **NO**
- R3 started: **NO**
