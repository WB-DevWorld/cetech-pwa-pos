-- R8-01 correction: allocated historic amount is non-negative Money, never DEFAULT 1.
-- Preserves committed 20260916220000_pos_return_line_allocations.sql. Append-only.
-- Recomputes existing rows from immutable pos_return_historic_lines using allocateHistoricMinor.

CREATE FUNCTION pos_r8_allocate_historic_minor(
  historical_total_minor bigint,
  original_sold numeric,
  previously_returned numeric,
  requested numeric
) RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  original_micros bigint;
  previous_micros bigint;
  requested_micros bigint;
BEGIN
  original_micros := round(original_sold * 1000000)::bigint;
  previous_micros := round(previously_returned * 1000000)::bigint;
  requested_micros := round(requested * 1000000)::bigint;
  IF original_micros <= 0
     OR requested_micros <= 0
     OR previous_micros + requested_micros > original_micros THEN
    RETURN NULL;
  END IF;
  IF previous_micros + requested_micros = original_micros THEN
    RETURN historical_total_minor - ((historical_total_minor * previous_micros) / original_micros);
  END IF;
  RETURN (historical_total_minor * requested_micros) / original_micros;
END;
$$;

ALTER TABLE pos_return_requested_lines
  DROP CONSTRAINT pos_return_requested_allocation_positive;

ALTER TABLE pos_return_requested_lines
  DISABLE TRIGGER pos_return_requested_lines_immutable;

DO $$
DECLARE
  unmatched integer;
BEGIN
  SELECT count(*) INTO unmatched
  FROM pos_return_requested_lines r
  LEFT JOIN pos_return_historic_lines h
    ON h.return_id = r.return_id
   AND h.order_line_id = r.order_line_id
  WHERE h.return_id IS NULL;
  IF unmatched > 0 THEN
    RAISE EXCEPTION
      'pos_return_requested_lines backfill: % row(s) lack a matching historic snapshot',
      unmatched;
  END IF;
END;
$$;

UPDATE pos_return_requested_lines AS r
SET
  allocated_historic_amount_minor = pos_r8_allocate_historic_minor(
    h.historical_total_minor,
    h.original_sold_quantity,
    h.previously_returned_quantity,
    r.quantity
  ),
  allocated_historic_currency = h.currency,
  remaining_returnable_quantity = h.remaining_returnable_quantity
FROM pos_return_historic_lines AS h
WHERE h.return_id = r.return_id
  AND h.order_line_id = r.order_line_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pos_return_requested_lines
    WHERE allocated_historic_amount_minor IS NULL
       OR remaining_returnable_quantity IS NULL
       OR allocated_historic_currency IS NULL
  ) THEN
    RAISE EXCEPTION
      'pos_return_requested_lines backfill produced NULL allocation, currency, or remaining quantity';
  END IF;
END;
$$;

ALTER TABLE pos_return_requested_lines
  ENABLE TRIGGER pos_return_requested_lines_immutable;

ALTER TABLE pos_return_requested_lines
  ALTER COLUMN allocated_historic_amount_minor DROP DEFAULT,
  ALTER COLUMN allocated_historic_currency DROP DEFAULT;

ALTER TABLE pos_return_requested_lines
  ADD CONSTRAINT pos_return_requested_allocation_nonnegative
  CHECK (allocated_historic_amount_minor >= 0);

ALTER TABLE pos_return_requested_lines
  ALTER COLUMN remaining_returnable_quantity SET NOT NULL;

COMMENT ON COLUMN pos_return_requested_lines.allocated_historic_amount_minor IS
  'Exact preview allocateHistoricMinor result. Non-negative Money, including 0 for free/fully-discounted historic lines. Never a synthetic default.';

COMMENT ON COLUMN pos_return_requested_lines.allocated_historic_currency IS
  'Currency copied from the immutable historic line snapshot at preview.';

COMMENT ON COLUMN pos_return_requested_lines.remaining_returnable_quantity IS
  'Server-owned remaining returnable quantity captured on the historic snapshot at preview.';

DROP FUNCTION pos_r8_allocate_historic_minor(bigint, numeric, numeric, numeric);
