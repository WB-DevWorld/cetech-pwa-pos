# Integration gates

Development readiness is separate from runtime acceptance: [ADR-011](../decisions/ADR/011.md). CP-04 development baseline is SATISFIED. The gates below still control the corresponding live integration claims; [CP-04 write-safety/cutover items](../runbooks/CP-04-REMAINING-WORK.md) block only their affected operations.

| Gate | Required evidence | Blocks |
| --- | --- | --- |
| G0 Control plane | Canonical commit, three ownership packages, contract freeze, CI, role/access limitations visible | Unbounded implementation |
| G1 Connectivity | Authenticated browser→BFF→Supabase and bridge→Woo; WoodMart/B2BKing detected; denied unauthorized path; no browser secrets | Live quoting |
| G2 Pricing | Full PRICING-PARITY.md matrix, exact line/tax/totals, customer isolation and overlap understood | Transactional checkout |
| G3 Preparation | Single Woo order under concurrency/crash/retry; verified stock commitment and online/POS last-unit race | Taking payment |
| G4 Cash slice | One tender/cash movement + order + stock effect + receipt + POS completion with failure recovery | Electronic/refund deepening |
| G5 Hardened operations | Provider pending/late/refund, RLS, blind close/Z, installed PWA retention | Rehearsal |

Record gate result, timestamp, commit, reviewer, environment and evidence location; none is inferred from this table. Missing facts block only dependent operations. 'Detected' plugins do not imply pricing parity.
