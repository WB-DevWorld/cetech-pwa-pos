-- First-write-wins immutability for sale.prepare intent_snapshot.
-- NULL -> A is allowed. A non-null snapshot cannot be replaced or cleared.

CREATE OR REPLACE FUNCTION pos_prepare_intent_snapshot_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.intent_snapshot IS NOT NULL
     AND NEW.intent_snapshot IS DISTINCT FROM OLD.intent_snapshot THEN
    RAISE EXCEPTION 'prepare intent snapshot is immutable once bound'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pos_prepare_intent_snapshot_immutable ON pos_pending_operations;
CREATE TRIGGER pos_prepare_intent_snapshot_immutable
  BEFORE UPDATE ON pos_pending_operations
  FOR EACH ROW
  EXECUTE FUNCTION pos_prepare_intent_snapshot_immutable();

COMMENT ON FUNCTION pos_prepare_intent_snapshot_immutable() IS
  'Durable sale.prepare presentation is append-once. The first non-null intent_snapshot wins permanently and cannot be replaced or cleared.';
