-- TF-01: durable mutual exclusion between cash ledger effects and electronic tender.
-- Additive only. Hosted apply is a separate release action (do not bulk-push with RD-01).

CREATE TABLE IF NOT EXISTS public.pos_sale_tender_claims (
  transaction_id uuid PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES public.pos_organizations (id),
  location_id pos_id NOT NULL,
  tender_family text NOT NULL CHECK (tender_family IN ('cash', 'electronic')),
  actor_id pos_id NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_sale_tender_claims_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES public.pos_locations (id, organization_id)
);

COMMENT ON TABLE public.pos_sale_tender_claims IS
  'One durable tender family per checkout transaction. Acquired before cash ledger or electronic provider effects. service_role writes only; not a browser surface.';

ALTER TABLE public.pos_sale_tender_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pos_sale_tender_claims FROM PUBLIC;
REVOKE ALL ON TABLE public.pos_sale_tender_claims FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.pos_sale_tender_claims TO service_role;

-- No authenticated policies: BFF/service_role only (matches other server-only checkout tables).
