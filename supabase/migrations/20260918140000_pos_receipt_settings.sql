-- Additive POS operational receipt settings. Not Woo/commerce truth.
-- Trusted-server write only. Missing rows mean backward-compatible defaults:
-- shorten_product_names=false, product_name_max_characters=40, show_sku=false.

CREATE TABLE pos_receipt_settings (
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL,
  shorten_product_names boolean NOT NULL DEFAULT false,
  product_name_max_characters integer NOT NULL DEFAULT 40
    CHECK (product_name_max_characters BETWEEN 1 AND 256),
  show_sku boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, location_id),
  CONSTRAINT pos_receipt_settings_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

COMMENT ON TABLE pos_receipt_settings IS
  'POS operational receipt presentation settings. Not catalog/commerce truth. Trusted-server write only. Absence of a row means shortening off, max 40 characters, SKU hidden.';

ALTER TABLE pos_receipt_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE pos_receipt_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE pos_receipt_settings TO service_role;
