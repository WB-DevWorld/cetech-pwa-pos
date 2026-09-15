-- PAY-01 / R7: generalize verified payments and add durable electronic intent
-- plus a provider event journal. Additive. Do not rewrite historical migrations.
-- Canonical POS payment state remains provider-neutral. Paystack stays behind
-- an adapter. Not a Woo order master and not a live-money authorization.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'pos_checkout_payments'
      AND c.contype = 'c'
  LOOP
    IF r.def ILIKE '%tender = ''cash''%'
       OR r.def ILIKE '%status = ''verified''%'
       OR r.def ILIKE '%verification_source = ''cash_ledger''%' THEN
      EXECUTE format('ALTER TABLE public.pos_checkout_payments DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE pos_checkout_payments
  ALTER COLUMN cash_received_minor DROP NOT NULL,
  ALTER COLUMN cash_received_currency DROP NOT NULL,
  ALTER COLUMN evidence_id DROP NOT NULL,
  ALTER COLUMN verified_at DROP NOT NULL,
  ALTER COLUMN verification_source DROP NOT NULL;

ALTER TABLE pos_checkout_payments
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS display_reference text,
  ADD COLUMN IF NOT EXISTS access_code text,
  ADD COLUMN IF NOT EXISTS initialize_status text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS attention_reason text;

ALTER TABLE pos_checkout_payments
  ADD CONSTRAINT pos_checkout_payments_tender_check
    CHECK (tender IN ('cash', 'mobile_money', 'card', 'external_electronic')),
  ADD CONSTRAINT pos_checkout_payments_status_check
    CHECK (status IN (
      'initializing', 'awaiting_customer', 'pending', 'cancelled', 'failed',
      'reconciling', 'requires_attention', 'verified'
    )),
  ADD CONSTRAINT pos_checkout_payments_verification_source_check
    CHECK (
      verification_source IS NULL
      OR verification_source IN (
        'cash_ledger', 'provider_server_verification', 'approved_external_attestation'
      )
    ),
  ADD CONSTRAINT pos_checkout_payments_initialize_status_check
    CHECK (
      initialize_status IS NULL
      OR initialize_status IN ('pending_remote', 'initialized', 'lost_response')
    ),
  ADD CONSTRAINT pos_checkout_payments_cash_fields_check
    CHECK (
      (
        tender = 'cash'
        AND status = 'verified'
        AND cash_received_minor IS NOT NULL
        AND cash_received_currency IS NOT NULL
        AND cash_received_currency = amount_currency
        AND evidence_id IS NOT NULL
        AND verified_at IS NOT NULL
        AND verification_source = 'cash_ledger'
        AND provider IS NULL
        AND provider_reference IS NULL
      )
      OR
      (
        tender IN ('mobile_money', 'card', 'external_electronic')
        AND cash_received_minor IS NULL
        AND cash_received_currency IS NULL
        AND provider IS NOT NULL
        AND provider_reference IS NOT NULL
        AND (
          (
            status = 'verified'
            AND evidence_id IS NOT NULL
            AND verified_at IS NOT NULL
            AND verification_source = 'provider_server_verification'
          )
          OR
          (
            status <> 'verified'
            AND (
              verification_source IS NULL
              OR verification_source = 'provider_server_verification'
            )
          )
        )
      )
    );

CREATE UNIQUE INDEX IF NOT EXISTS pos_checkout_payments_provider_reference_uq
  ON pos_checkout_payments (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pos_checkout_payments_one_verified_per_transaction
  ON pos_checkout_payments (transaction_id)
  WHERE status = 'verified';

COMMENT ON TABLE pos_checkout_payments IS
  'Durable POS payment intent and verified tender evidence. One row per transaction. Cash received is cash-only. Electronic provider references are unique. Trusted-server write only.';

CREATE TABLE pos_provider_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id pos_id REFERENCES pos_organizations (id),
  location_id pos_id,
  provider text NOT NULL,
  provider_reference text,
  provider_transaction_id text,
  event_type text NOT NULL,
  event_fingerprint text NOT NULL,
  raw_body_hash text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_status text NOT NULL CHECK (processing_status IN (
    'ingested', 'processed', 'ignored', 'requires_attention'
  )),
  normalized_status text,
  payment_id uuid REFERENCES pos_checkout_payments (payment_id),
  transaction_id uuid,
  CONSTRAINT pos_provider_payment_events_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id),
  CONSTRAINT pos_provider_payment_events_fingerprint_uq UNIQUE (provider, event_fingerprint)
);

CREATE INDEX pos_provider_payment_events_reference_idx
  ON pos_provider_payment_events (provider, provider_reference);

CREATE INDEX pos_provider_payment_events_payment_idx
  ON pos_provider_payment_events (payment_id);

COMMENT ON TABLE pos_provider_payment_events IS
  'Provider webhook/event journal. Duplicate deliveries collapse on (provider, event_fingerprint). Raw bodies are hashed; secrets are not stored. Trusted-server write only.';

ALTER TABLE pos_provider_payment_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE pos_provider_payment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE pos_provider_payment_events TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE pos_checkout_payments TO service_role;
