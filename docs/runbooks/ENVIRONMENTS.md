# Environment and secret ownership

Current reference and gates: [ADR-011](../decisions/ADR/011.md), [CP-04 remaining work](CP-04-REMAINING-WORK.md). Training is sufficient for local development; safe remote-write testing is a separate determination. Production facts are verified before the affected production operation, not before unrelated coding.

| Environment | Dependencies | Write policy |
| --- | --- | --- |
| Local | Local Supabase/WP or explicit isolated staging sandbox | Synthetic/sanitized fixtures only |
| PR preview | Separate preview/staging data and payment sandbox | No production Woo/service/payment credentials |
| Training / staging | training.cetechbpa.com is the reference; isolated local/synthetic services also supported | Read-only baseline known. Remote write/rehearsal needs operation-specific containment; no real customer settlement |
| Production | Verified live services/hardware | Human-approved artifact/config promotion only |

.env.example lists placeholders. Actual values belong to ignored local .env files and deployment secret settings; WordPress service credential provisioned by authorized admin. Elevated Supabase key, Woo keys, application password, payment secret and database URL never reach client code/logs/task prompts. A public/publishable key is not an authorization boundary. Environment schema rejects production URLs/keys in previews; trusted server configuration picks providers. Keep independent recovery contacts outside each protected service.
