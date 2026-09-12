# POS operational migrations

WS3 is the single migration editor. CORE-01 introduces the first ordered migration.

- Never edit a migration after it has been merged to `main`.
- Do not store Woo products, customers, prices, or orders as POS masters.
- Local only: `npx supabase@2.117.0 db reset --local` then `npx supabase@2.117.0 test db`.
- Supabase `service_role` bypasses RLS. That is not business authorization.
