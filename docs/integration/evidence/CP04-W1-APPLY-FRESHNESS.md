# CP04-W1 apply two-pass freshness

Declared upstreams: `origin/main`, `origin/batch/r2-auth-bridge-bff`.
Observer: WS3 senior / @wbdevworld.
START_FRESHNESS_UTC: `2026-09-13T00:20:37Z`
Evidence commit (pre-freshness): `af7e2a268229b2fe4cf6a3df495dc030646328ac`

## Pass 1

- Fetch UTC: `2026-09-13T06:09:56Z` (`git fetch origin --prune` EXIT 0)
- `FRESHNESS_PASS_1_MAIN_SHA` = `aa08d74f2cb99301817e5995f01486acb7e2169f`
- `FRESHNESS_PASS_1_R2_SHA` = `3a1b6b579781130afc9bd9792405b182c7bfe5ca`
- Arrivals vs start: none
- Verification: `python scripts/verify_control_plane.py` EXIT 0

## Pass 2

- Fetch UTC: `2026-09-13T06:09:58Z` (`git fetch origin --prune` EXIT 0)
- `FRESHNESS_PASS_2_MAIN_SHA` = `aa08d74f2cb99301817e5995f01486acb7e2169f`
- `FRESHNESS_PASS_2_R2_SHA` = `3a1b6b579781130afc9bd9792405b182c7bfe5ca`
- Arrivals after Pass 1: none
- Pass 3: **NOT PERMITTED**

Final freshness status: **FRESH_2**
