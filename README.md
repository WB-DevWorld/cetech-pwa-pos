# CETECH PWA POS

Engineering control plane for a three-person, 60-hour production MVP. Canonical repository: https://github.com/WB-DevWorld/cetech-pwa-pos (public; changed by the user and verified 2026-09-12).

**Implementation status:** foundation and contract specifications only. No production app, bridge, database schema or live integrations are claimed. The preserved prototype is a simulated design reference.

Start with [AGENTS.md](AGENTS.md), [CURRENT-WORK.md](CURRENT-WORK.md), [START-NOW.md](docs/plans/START-NOW.md) and your [workstream](docs/workstreams/README.md).

```bash
python3 scripts/verify_control_plane.py
```

This dependency-free foundation check validates structure, reference integrity, contract generation, schema references and task readiness. It is not a checkout/pricing/RLS test. Install app dependencies only after WS3 pins the scaffold/toolchain in CP-05.

## Navigation
- [Constitution](PROJECT-CONSTITUTION.md) / [authority](SOURCE-OF-TRUTH.md) / [ownership](OWNERSHIP.md)
- [Architecture](docs/architecture/CURRENT-ARCHITECTURE.md) / [decisions](docs/decisions/DECISION-REGISTER.md)
- [Frozen v1 contracts](docs/contracts/README.md) / [live facts](LIVE-ENVIRONMENT-FACTS.md)
- [60-hour plan](docs/plans/60-HOUR-EXECUTION-PLAN.md) / [task index](docs/plans/TASK-INDEX.md)
- [Reference manifest](reference/frontend-approved/MANIFEST.md)
- [GitHub remaining setup](docs/runbooks/GITHUB-SETUP.md) / [readiness](docs/integration/READINESS.md)

The first shared product slice is staff login → open register → scan/search → customer → authoritative quote → prepare one Woo order → cash → stock → receipt → POS workflow recorded.
