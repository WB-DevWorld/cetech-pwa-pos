# Database standard

WS3 is migration captain. One editor/ordered additive migration sequence; never edit merged migrations. Reset a local database from zero in CI when schema exists. Avoid cross-provider/peer database foreign keys. POS tables: staff memberships/devices/registers/shifts/cash movements/transactions/payment evidence/receipts/journal/outbox/audit/config; source projections clearly named and rebuildable. Unique constraints enforce transaction mapping, operation keys, tender evidence, receipt per transaction and active/closing shift per register. Never rely on read-then-write check for uniqueness. Financial history append-only; reversal/correction linked to original. RLS+grants ship in same migration; test anonymous and wrong tenant/location/role/actor. Backup/restore proof before live schema promotion.

Owner: WS3. Controlling contracts/ADRs outrank generic examples. Done = evidence.
