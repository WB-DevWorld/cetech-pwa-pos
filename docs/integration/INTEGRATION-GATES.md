# Integration gates

| Gate | Required evidence | Blocks |
| --- | --- | --- |
| G0 Control plane | Canonical commit, three ownership packages, contract freeze, CI, role/access limitations visible | Unbounded implementation |
| G1 Connectivity | Authenticated browser→BFF→Supabase and bridge→Woo; WoodMart/B2BKing detected; denied unauthorized path; no browser secrets | Live quoting |
| G2 Pricing | Full PRICING-PARITY.md matrix, exact line/tax/totals, customer isolation and overlap understood | Transactional checkout |
| G3 Preparation | Single Woo order under concurrency/crash/retry; verified stock commitment and online/POS last-unit race | Taking payment |
| G4 Cash slice | One tender/cash movement + order + stock effect + receipt + POS completion with failure recovery | Electronic/refund deepening |
| G5 Hardened operations | Provider pending/late/refund, RLS, blind close/Z, installed PWA retention | Rehearsal |

Record gate result, timestamp, commit, reviewer, environment and evidence location; none is inferred from this table. Missing facts block only dependent operations. 'Detected' plugins do not imply pricing parity.
