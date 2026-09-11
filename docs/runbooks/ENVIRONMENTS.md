# Environment and secret ownership

| Environment | Dependencies | Write policy |
| --- | --- | --- |
| Local | Local Supabase/WP or explicit isolated staging sandbox | Synthetic/sanitized fixtures only |
| PR preview | Separate preview/staging data and payment sandbox | No production Woo/service/payment credentials |
| Staging | Woo clone + matching configured plugins; Supabase test project | Rehearsal, no real customer settlement |
| Production | Verified live services/hardware | Human-approved artifact/config promotion only |

.env.example lists placeholders. Actual values belong to ignored local .env files and deployment secret settings; WordPress service credential provisioned by authorized admin. Elevated Supabase key, Woo keys, application password, payment secret and database URL never reach client code/logs/task prompts. A public/publishable key is not an authorization boundary. Environment schema rejects production URLs/keys in previews; trusted server configuration picks providers. Keep independent recovery contacts outside each protected service.
