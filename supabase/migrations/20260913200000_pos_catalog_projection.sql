-- CORE-04 rebuildable catalog projection.
-- Not PIM/commerce master. Not live inventory. Barcodes are text (leading zeroes preserved).
-- Duplicate barcodes are allowed. Trusted-server write only.

CREATE TABLE pos_catalog_items (
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  item_id pos_id NOT NULL,
  source_system text NOT NULL CHECK (
    char_length(source_system) BETWEEN 1 AND 64
    AND source_system ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  source_item_id text NOT NULL CHECK (char_length(source_item_id) BETWEEN 1 AND 128),
  source_version text NOT NULL CHECK (char_length(source_version) BETWEEN 1 AND 128),
  projection_version bigint NOT NULL CHECK (projection_version >= 0),
  parent_id pos_id,
  kind text NOT NULL CHECK (kind IN ('simple', 'variable', 'variation')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 256),
  sku text CHECK (sku IS NULL OR char_length(sku) BETWEEN 1 AND 128),
  barcodes text[] NOT NULL DEFAULT ARRAY[]::text[],
  search_normalized text NOT NULL DEFAULT '',
  variation_label text,
  display_price_minor pos_money_minor,
  display_currency pos_currency,
  stock_status text NOT NULL DEFAULT 'unknown' CHECK (stock_status IN (
    'in_stock', 'low_stock', 'out_of_stock', 'backorder', 'unknown'
  )),
  tombstoned_at timestamptz,
  projection_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, item_id),
  CONSTRAINT pos_catalog_variation_parent CHECK (
    (kind = 'variation' AND parent_id IS NOT NULL)
    OR (kind <> 'variation')
  )
);

CREATE INDEX pos_catalog_org_search_idx
  ON pos_catalog_items (organization_id, search_normalized);

CREATE INDEX pos_catalog_org_parent_idx
  ON pos_catalog_items (organization_id, parent_id);

CREATE INDEX pos_catalog_org_barcode_idx
  ON pos_catalog_items USING GIN (barcodes);

COMMENT ON TABLE pos_catalog_items IS
  'Rebuildable catalog/PIM projection. Not Woo master. Not live inventory. Barcodes are strings so leading zeroes are preserved. Duplicate barcodes are allowed. Trusted-server write; authenticated clients do not select or mutate. Local Dexie is the cashier-facing cache.';

COMMENT ON COLUMN pos_catalog_items.stock_status IS
  'Advisory catalog presentation only. Live stock truth stays outside this projection.';

COMMENT ON COLUMN pos_catalog_items.barcodes IS
  'Exact barcode strings. Do not cast to numeric. Duplicate values across rows are an explicit disambiguation case.';

ALTER TABLE pos_catalog_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE pos_catalog_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE pos_catalog_items TO service_role;
