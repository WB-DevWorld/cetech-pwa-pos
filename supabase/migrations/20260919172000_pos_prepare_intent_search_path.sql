-- Harden the REC-01 trigger function against mutable search_path resolution.
-- The trigger body only inspects OLD/NEW row values, so pg_catalog is sufficient.

ALTER FUNCTION public.pos_prepare_intent_snapshot_immutable()
  SET search_path = pg_catalog;
