# Toolchain and available checks

| Component | Bootstrap state | Owner / activation |
| --- | --- | --- |
| Python standard library, 3.10+ | Foundation verifier/generator available | WS3; CI Ubuntu plus Windows Python 3.10 |
| Node / pnpm / Next / React / TypeScript | UNVERIFIED; not installed as an app | CP-05 verifies official compatibility/security and pins exact versions |
| PHP / Woo / WordPress | Staging versions user-reported in LIVE-ENVIRONMENT-FACTS.md; compatibility untested | CP-04 + BR-01 set compatible checks |
| Supabase CLI / PostgreSQL | Project/config/schema not created yet | CORE-01 pins CLI and adds reset/RLS tests |
| Runtime JSON Schema validator / Playwright | Not scaffolded | CP-05/CORE-06 pins maintained packages |

Active foundation checks: `python scripts/verify_control_plane.py` (generator drift, bounded schema-fixture checks, strict reference hashes) and `python -m unittest discover -s tests/tooling -v` (GitHub setup and Windows/reference regressions). Python 3.10+; `python3` is also suitable where installed. CI status names: **control-plane** and **control-plane-windows**. No app checks are claimed by these tooling tests.

CP-05 must provide `pnpm --dir apps/pos-web lint`, `typecheck`, `test`, `build`, `test:e2e`, root frozen-lockfile install and full tsconfig. BR-01 adds Makefile `check`, `test`, `parity` targets in plugin. CORE-01 adds `supabase db reset --local` and `supabase test db`. Missing prerequisites are blocked, not passed. Add real checks to CI in the same scaffold PR; do not leave main red for nonexistent packages. When adding a package, update this availability table and add its actual CI checks in the same scaffold PR.
