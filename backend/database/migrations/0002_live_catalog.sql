ALTER TABLE canonical_products
  ADD COLUMN source_provider text,
  ADD COLUMN source_product_id text,
  ADD COLUMN source_variant_id text,
  ADD COLUMN source_merchant_domain text,
  ADD COLUMN catalog_identity_key text,
  ADD COLUMN catalog_refreshed_at timestamptz;

CREATE UNIQUE INDEX canonical_products_source_variant_idx
  ON canonical_products (source_provider, source_merchant_domain, source_variant_id)
  WHERE source_provider IS NOT NULL
    AND source_merchant_domain IS NOT NULL
    AND source_variant_id IS NOT NULL;

CREATE UNIQUE INDEX canonical_products_catalog_identity_idx
  ON canonical_products (catalog_identity_key)
  WHERE catalog_identity_key IS NOT NULL;

CREATE UNIQUE INDEX product_images_product_url_idx
  ON product_images (product_id, image_url);

CREATE INDEX merchant_listings_recent_product_idx
  ON merchant_listings (canonical_product_id, last_seen_at DESC);

CREATE UNIQUE INDEX user_product_confirmations_scan_product_idx
  ON user_product_confirmations (user_id, scan_id, product_id)
  WHERE scan_id IS NOT NULL;
