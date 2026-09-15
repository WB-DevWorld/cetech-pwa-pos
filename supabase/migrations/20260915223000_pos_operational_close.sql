-- CORE-07 atomic blind shift close and immutable Z report.
-- Expected cash remains server-owned. The client supplies counted cash only.

CREATE TABLE pos_shift_reports (
  id pos_id PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL REFERENCES pos_locations (id),
  register_id pos_id NOT NULL REFERENCES pos_registers (id),
  shift_id uuid NOT NULL REFERENCES pos_shifts (id),
  kind text NOT NULL CHECK (kind IN ('X', 'Z')),
  expected_cash_minor pos_money_minor NOT NULL,
  counted_cash_minor pos_money_minor,
  variance_minor pos_signed_minor,
  currency pos_currency NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_shift_reports_shift_org_loc_fk
    FOREIGN KEY (shift_id, organization_id, location_id)
    REFERENCES pos_shifts (id, organization_id, location_id),
  CONSTRAINT pos_shift_reports_one_kind_per_shift UNIQUE (shift_id, kind),
  CONSTRAINT pos_shift_reports_z_complete CHECK (
    kind <> 'Z'
    OR (counted_cash_minor IS NOT NULL AND variance_minor IS NOT NULL)
  )
);

CREATE INDEX pos_shift_reports_scope_idx
  ON pos_shift_reports (organization_id, location_id, register_id, shift_id);

CREATE OR REPLACE FUNCTION pos_shift_report_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'shift reports are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER pos_shift_report_immutable
  BEFORE UPDATE OR DELETE ON pos_shift_reports
  FOR EACH ROW
  EXECUTE FUNCTION pos_shift_report_immutable();

ALTER TABLE pos_shift_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pos_shift_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE pos_shift_reports TO service_role;

COMMENT ON TABLE pos_shift_reports IS
  'Immutable register report snapshots. CORE-07 creates exactly one Z report per closed shift. Expected cash is server-derived and never client authority.';

CREATE OR REPLACE FUNCTION pos_close_shift_blind(
  p_organization_id text,
  p_shift_id uuid,
  p_counted_cash_minor bigint,
  p_currency char(3),
  p_idempotency_key uuid,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sh pos_shifts%ROWTYPE;
  report_row pos_shift_reports%ROWTYPE;
  existing_claim pos_pending_operations%ROWTYPE;
  report_id pos_id;
  outcome jsonb;
BEGIN
  IF p_counted_cash_minor < 0 OR p_counted_cash_minor > 9007199254740991 THEN
    RAISE EXCEPTION 'invalid counted cash' USING ERRCODE = '23514';
  END IF;
  IF p_request_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid request hash' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO sh
  FROM pos_shifts
  WHERE id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift not found' USING ERRCODE = 'P0002';
  END IF;
  IF sh.organization_id IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'shift is out of organization scope' USING ERRCODE = '42501';
  END IF;
  IF sh.expected_cash_currency IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION 'counted cash currency must match shift' USING ERRCODE = '23514';
  END IF;

  report_id := ('Z:' || sh.id::text)::pos_id;

  SELECT * INTO existing_claim
  FROM pos_pending_operations
  WHERE organization_id = sh.organization_id
    AND operation = 'shift.close'
    AND idempotency_key = p_idempotency_key;

  IF FOUND AND existing_claim.request_hash IS DISTINCT FROM p_request_hash THEN
    RAISE EXCEPTION 'idempotency conflict' USING ERRCODE = '23505';
  END IF;

  IF sh.status = 'closed' THEN
    SELECT * INTO report_row
    FROM pos_shift_reports
    WHERE shift_id = sh.id AND kind = 'Z';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'closed shift is missing Z report' USING ERRCODE = '55000';
    END IF;
    IF report_row.counted_cash_minor IS DISTINCT FROM p_counted_cash_minor
       OR report_row.currency IS DISTINCT FROM p_currency THEN
      RAISE EXCEPTION 'closed shift cannot be recounted' USING ERRCODE = '23505';
    END IF;

    outcome := jsonb_build_object('shift', to_jsonb(sh), 'report', to_jsonb(report_row));

    IF NOT FOUND OR existing_claim.id IS NULL THEN
      INSERT INTO pos_pending_operations (
        organization_id, location_id, register_id, shift_id,
        operation, idempotency_key, request_hash, status, attempts,
        created_at, last_attempt_at, outcome
      ) VALUES (
        sh.organization_id, sh.location_id, sh.register_id, sh.id,
        'shift.close', p_idempotency_key, p_request_hash, 'acknowledged', 1,
        now(), now(), outcome
      );
    ELSE
      UPDATE pos_pending_operations
      SET status = 'acknowledged', attempts = GREATEST(attempts, 1),
          last_attempt_at = now(), outcome = outcome
      WHERE id = existing_claim.id;
    END IF;
    RETURN outcome;
  END IF;

  IF sh.status NOT IN ('open', 'closing') THEN
    RAISE EXCEPTION 'shift is not closable' USING ERRCODE = '55000';
  END IF;

  IF existing_claim.id IS NULL THEN
    INSERT INTO pos_pending_operations (
      organization_id, location_id, register_id, shift_id,
      operation, idempotency_key, request_hash, status, attempts,
      created_at, last_attempt_at
    ) VALUES (
      sh.organization_id, sh.location_id, sh.register_id, sh.id,
      'shift.close', p_idempotency_key, p_request_hash, 'sent', 1,
      now(), now()
    );
  ELSIF existing_claim.status = 'acknowledged' AND existing_claim.outcome IS NOT NULL THEN
    RETURN existing_claim.outcome;
  ELSE
    UPDATE pos_pending_operations
    SET status = 'sent', attempts = attempts + 1, last_attempt_at = now()
    WHERE id = existing_claim.id;
  END IF;

  UPDATE pos_shifts
  SET status = 'closed',
      counted_cash_minor = p_counted_cash_minor,
      z_report_id = report_id
  WHERE id = sh.id
  RETURNING * INTO sh;

  INSERT INTO pos_shift_reports (
    id, organization_id, location_id, register_id, shift_id, kind,
    expected_cash_minor, counted_cash_minor, variance_minor, currency, created_at
  ) VALUES (
    report_id, sh.organization_id, sh.location_id, sh.register_id, sh.id, 'Z',
    sh.expected_cash_minor, sh.counted_cash_minor, sh.variance_minor,
    sh.expected_cash_currency, sh.closed_at
  )
  ON CONFLICT (shift_id, kind) DO NOTHING;

  SELECT * INTO report_row
  FROM pos_shift_reports
  WHERE shift_id = sh.id AND kind = 'Z';

  IF report_row.id IS NULL
     OR report_row.counted_cash_minor IS DISTINCT FROM sh.counted_cash_minor
     OR report_row.variance_minor IS DISTINCT FROM sh.variance_minor THEN
    RAISE EXCEPTION 'Z report does not match closed shift' USING ERRCODE = '55000';
  END IF;

  outcome := jsonb_build_object('shift', to_jsonb(sh), 'report', to_jsonb(report_row));

  UPDATE pos_pending_operations
  SET status = 'acknowledged', outcome = outcome, last_attempt_at = now()
  WHERE organization_id = sh.organization_id
    AND operation = 'shift.close'
    AND idempotency_key = p_idempotency_key;

  INSERT INTO pos_outbox_events (
    organization_id, location_id, aggregate_type, aggregate_id,
    event_type, payload, correlation_id
  ) VALUES (
    sh.organization_id, sh.location_id, 'shift', sh.id::text,
    'shift.closed',
    jsonb_build_object('shiftId', sh.id::text, 'zReportId', report_row.id::text),
    p_idempotency_key
  );

  RETURN outcome;
END;
$$;

REVOKE ALL ON FUNCTION pos_close_shift_blind(text, uuid, bigint, char(3), uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pos_close_shift_blind(text, uuid, bigint, char(3), uuid, text)
  TO service_role;

COMMENT ON FUNCTION pos_close_shift_blind(text, uuid, bigint, char(3), uuid, text) IS
  'Atomic server-only blind close: locks the shift, derives variance from server-owned expected cash, closes once, creates one immutable Z report, and acknowledges shift.close idempotency in the same transaction.';
