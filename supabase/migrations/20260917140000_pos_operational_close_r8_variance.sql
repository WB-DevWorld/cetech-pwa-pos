-- R9-on-R8 corrective migration.
-- Historical 20260915223000_pos_operational_close.sql remains as committed CORE-07
-- provenance. It closed a shift and minted a Z even when counted cash disagreed
-- with server-owned expected cash. Accepted R8 variance forbids that:
--   varianceMinor === 0 ? closed + exactly one durable Z
--   else requires_attention, no closedAt, no Z
-- approvalId is not a database parameter and has zero close authority.
-- This later timestamp replaces only the RPC body; it does not rewrite history.

CREATE OR REPLACE FUNCTION pos_close_shift_blind(
  p_organization_id text,
  p_shift_id uuid,
  p_counted_cash_minor bigint,
  p_currency char(3),
  p_idempotency_key uuid,
  p_correlation_id uuid,
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
  v_outcome jsonb;
  v_variance bigint;
  v_event_type text;
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

    v_outcome := jsonb_build_object('shift', to_jsonb(sh), 'report', to_jsonb(report_row));

    IF existing_claim.id IS NULL THEN
      INSERT INTO pos_pending_operations (
        organization_id, location_id, register_id, shift_id,
        operation, idempotency_key, request_hash, status, attempts,
        created_at, last_attempt_at, outcome
      ) VALUES (
        sh.organization_id, sh.location_id, sh.register_id, sh.id,
        'shift.close', p_idempotency_key, p_request_hash, 'acknowledged', 1,
        now(), now(), v_outcome
      );
    ELSE
      UPDATE pos_pending_operations AS ppo
      SET status = 'acknowledged', attempts = GREATEST(ppo.attempts, 1),
          last_attempt_at = now(), outcome = v_outcome
      WHERE ppo.id = existing_claim.id;
    END IF;
    RETURN v_outcome;
  END IF;

  IF existing_claim.id IS NOT NULL
     AND existing_claim.status = 'acknowledged'
     AND existing_claim.outcome IS NOT NULL THEN
    RETURN existing_claim.outcome;
  END IF;

  IF sh.status NOT IN ('open', 'closing', 'requires_attention') THEN
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
  ELSE
    UPDATE pos_pending_operations AS ppo
    SET status = 'sent', attempts = ppo.attempts + 1, last_attempt_at = now()
    WHERE ppo.id = existing_claim.id;
  END IF;

  v_variance := p_counted_cash_minor - sh.expected_cash_minor;

  IF v_variance = 0 THEN
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

    v_outcome := jsonb_build_object('shift', to_jsonb(sh), 'report', to_jsonb(report_row));
    v_event_type := 'shift.closed';
  ELSE
    UPDATE pos_shifts
    SET status = 'requires_attention',
        counted_cash_minor = p_counted_cash_minor,
        counted_cash_currency = p_currency,
        variance_minor = v_variance,
        variance_currency = sh.expected_cash_currency,
        closed_at = NULL,
        z_report_id = NULL
    WHERE id = sh.id
    RETURNING * INTO sh;

    IF EXISTS (
      SELECT 1 FROM pos_shift_reports WHERE shift_id = sh.id AND kind = 'Z'
    ) THEN
      RAISE EXCEPTION 'requires_attention shift must not have a Z report' USING ERRCODE = '55000';
    END IF;

    v_outcome := jsonb_build_object('shift', to_jsonb(sh), 'report', NULL);
    v_event_type := 'shift.requires_attention';
  END IF;

  UPDATE pos_pending_operations AS ppo
  SET status = 'acknowledged', outcome = v_outcome, last_attempt_at = now()
  WHERE ppo.organization_id = sh.organization_id
    AND ppo.operation = 'shift.close'
    AND ppo.idempotency_key = p_idempotency_key;

  INSERT INTO pos_outbox_events (
    organization_id, location_id, aggregate_type, aggregate_id,
    event_type, payload, correlation_id
  ) VALUES (
    sh.organization_id, sh.location_id, 'shift', sh.id::text,
    v_event_type,
    CASE
      WHEN v_event_type = 'shift.closed' THEN
        jsonb_build_object('shiftId', sh.id::text, 'zReportId', report_row.id::text)
      ELSE
        jsonb_build_object('shiftId', sh.id::text, 'status', 'requires_attention')
    END,
    p_correlation_id
  );

  RETURN v_outcome;
END;
$$;

COMMENT ON FUNCTION pos_close_shift_blind(text, uuid, bigint, char(3), uuid, uuid, text) IS
  'Atomic server-only close with R8 variance: zero variance closes once and creates one immutable Z; non-zero variance stays requires_attention with no Z and no closedAt. approvalId has no close authority.';
