# CP04-W4 apply two-pass freshness

Declared upstreams: `origin/main`, `origin/batch/r2-auth-bridge-bff`.
Observer: WS3 senior / @wbdevworld.
START_FRESHNESS_UTC: `2026-09-13T06:15:28Z`
Evidence commit (pre-freshness): `67ea42ce03142fb9f0ca18446b8146b0815ea621`

## Pass 1

- Fetch UTC: `2026-09-13T06:27:06Z` (`git fetch origin --prune` EXIT 0)
- `FRESHNESS_PASS_1_MAIN_SHA` = `aa08d74f2cb99301817e5995f01486acb7e2169f`
- `FRESHNESS_PASS_1_R2_SHA` = `3a1b6b579781130afc9bd9792405b182c7bfe5ca`
- Arrivals vs start: none
- Verification: `python scripts/verify_control_plane.py` EXIT 0

## Pass 2

- Fetch UTC: `2026-09-13T06:27:08Z` (`git fetch origin --prune` EXIT 0)
- `FRESHNESS_PASS_2_MAIN_SHA` = `aa08d74f2cb99301817e5995f01486acb7e2169f`
- `FRESHNESS_PASS_2_R2_SHA` = `3a1b6b579781130afc9bd9792405b182c7bfe5ca`
- Arrivals after Pass 1: none
- Pass 3: **NOT PERMITTED**

Final freshness status: **FRESH_2**
