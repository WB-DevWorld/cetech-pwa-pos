# Current work ledger

Updated 2026-09-11. Canonical repo WB-DevWorld/cetech-pwa-pos. Senior @wbdevworld owns integration/migrations/contracts/config. GitHub issues are live task/status evidence; this table is the cross-workstream coordination summary.

| Task | Owner | Branch | Status | Dependencies / blocked by | Contracts | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01/02/03 | WS3 | bootstrap control plane | Foundation locally created; remote commit verification pending | GitHub publish/check | v1.0.0 | First |
| CP-04 | WS3 + WS2 evidence | ws3/cp-04-live-audit | SPECIFIED | Human live environment access | Environment policy | Before live integration |
| CP-05 | WS3 | ws3/cp-05-scaffold | SPECIFIED | CP-03; actual toolchain verification | v1 reexports | Shared foundation first |
| FE-01 | WS1 | ws1/fe-01-reference-map | READY for read-only mapping/local task branch once repo available | Colleague identity/access UNVERIFIED | Prototype→v1 mapping | Independent |
| BR-01 | WS2 | ws2/br-01-health | SPECIFIED | CP-04 staging/plugin facts | Bridge v1 | After live inputs |
| CORE-01 | WS3 | ws3/core-01-schema | SPECIFIED | CP-04/05 | POS operational models | One migration editor |

Central edit lease: bootstrap foundation WS3 only. No other active editor assigned. Release lease after commit/check and record next central task; never let multiple agents claim lockfile/schema/migrations simultaneously.

Live pricing/health/RLS/payment/hardware/production gates: UNVERIFIED. Main protection requires manual configuration/plan support. Initial tasks are not proof of implementation.
