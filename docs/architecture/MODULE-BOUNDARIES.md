# Module boundaries

- features/ui → core contracts/application interfaces. No provider SDK imports, server secrets, database clients or PHP assumptions.
- core → provider-neutral contracts/use cases. No Woo/WordPress/Supabase/provider SDK dependency.
- server → auth policy, BFF routes, infrastructure adapters and integration orchestration; server-only imports protect privileged code.
- local → Dexie stores, local adapters, schema migration and multi-tab coordination (WS3 single editor).
- app → Next routing/composition, delegates renderable components to WS1 (WS3 root scaffold owner).
- wordpress → independently buildable bridge; owns Woo runtime integration only.
- supabase → POS operational migrations/RLS and projection storage only.

UI may request commands; server derives actor/scope/prices/permissions. A contract change crosses workstreams and needs owner review before dependent edits. A query is not a mutation; no charge/order creation on page refresh. Provider capabilities unavailable → truthful degraded state and disabled dependent action.
