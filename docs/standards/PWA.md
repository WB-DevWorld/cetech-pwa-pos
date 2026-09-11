# Pwa standard

Controlled worker updates: check on open/foreground/reconnect and throttled long sessions. Update-ready UX waits for payment/edit/sync/critical recovery safe points. Coordinate tabs and schema migrations; one writer/leader with server idempotency as final defense. Separate replaceable shell/cache, rebuildable projections and critical draft/journal data. Never routinely clear IndexedDB/auth/all caches. Exclude privileged/sensitive API responses from service-worker cache. Keep immutable previous assets/API compatibility for supported installed versions; rollback/forward repair planned. Recovery route should load even when main bundle fails. Export/protect critical local state before any explicitly approved last-resort reset. Tests cover installed old/skipped versions, interrupted update, offline pending work, quota, broken bundle and blocked multi-tab migration.

Owner: WS3. Controlling contracts/ADRs outrank generic examples. Done = evidence.
