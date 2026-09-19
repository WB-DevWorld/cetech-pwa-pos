-- Harden R9 operational-close functions against mutable/untrusted name resolution.
-- Historical migrations remain unchanged; this additive migration updates only function configuration.

ALTER FUNCTION public.pos_shift_report_immutable()
  SET search_path = pg_catalog;

ALTER FUNCTION public.pos_close_shift_blind(text, uuid, bigint, char(3), uuid, uuid, text)
  SET search_path = pg_catalog, public;
