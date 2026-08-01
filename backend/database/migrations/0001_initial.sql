CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE scan_status AS ENUM (
  'CREATED',
  'IMAGE_UPLOADED',
  'PREPROCESSING',
  'EVIDENCE_EXTRACTED',
  'REQUIRES_MORE_EVIDENCE',
  'CANDIDATES_RETRIEVED',
  'VERIFYING',
  'EXACT_VERIFIED',
  'SIMILAR_FOUND',
  'AMBIGUOUS',
  'SEARCHING_MERCHANTS',
  'OFFERS_READY',
  'AWAITING_APPROVAL',
  'PAYMENT_SESSION_CREATED',
  'CHECKOUT_IN_PROGRESS',
  'ORDER_COMPLETED',
  'CHECKOUT_FAILED'
);

CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint,
  sha256 text,
  purpose text NOT NULL CHECK (purpose IN ('product_scan', 'additional_evidence')),
  status text NOT NULL DEFAULT 'PRESIGNED' CHECK (status IN ('PRESIGNED', 'STORED', 'ATTACHED', 'DELETED')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX uploads_user_created_idx ON uploads (user_id, created_at DESC);

CREATE TABLE scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  status scan_status NOT NULL DEFAULT 'CREATED',
  mode text NOT NULL CHECK (mode IN ('exact', 'similar_allowed')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  max_budget_minor bigint CHECK (max_budget_minor >= 0),
  currency char(3),
  country_code char(2),
  observation jsonb,
  next_capture jsonb,
  selected_product_id uuid,
  error_code text,
  error_message text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scans_user_created_idx ON scans (user_id, created_at DESC);
CREATE INDEX scans_status_idx ON scans (status, updated_at);

CREATE TABLE scan_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES uploads(id),
  role text NOT NULL CHECK (role IN ('primary', 'label', 'barcode', 'object_crop', 'thumbnail')),
  object_key text NOT NULL,
  processed_object_key text,
  thumbnail_object_key text,
  width integer,
  height integer,
  blur_score numeric(8,5),
  brightness_score numeric(8,5),
  sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_id, upload_id, role)
);

CREATE INDEX scan_images_scan_idx ON scan_images (scan_id);
CREATE INDEX scan_images_hash_idx ON scan_images (sha256) WHERE sha256 IS NOT NULL;

CREATE TABLE scan_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  value jsonb NOT NULL,
  normalized_value text,
  source text NOT NULL CHECK (source IN ('barcode_decoder', 'ocr', 'vision_model', 'user', 'catalogue', 'policy')),
  confidence numeric(5,4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source_image_id uuid REFERENCES scan_images(id),
  model_version text,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scan_evidence_scan_idx ON scan_evidence (scan_id, evidence_type);
CREATE INDEX scan_evidence_normalized_idx ON scan_evidence (normalized_value) WHERE normalized_value IS NOT NULL;

CREATE TABLE canonical_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  brand text,
  name text NOT NULL,
  variant text,
  size_value numeric,
  size_unit text,
  gtin text,
  upc text,
  ean text,
  mpn text,
  model_number text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(brand, '') || ' ' || name || ' ' || coalesce(variant, '') || ' ' || coalesce(model_number, '') || ' ' || coalesce(mpn, ''))
  ) STORED,
  text_embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX canonical_products_gtin_idx ON canonical_products (gtin) WHERE gtin IS NOT NULL;
CREATE INDEX canonical_products_identifier_idx ON canonical_products (model_number, mpn);
CREATE INDEX canonical_products_search_idx ON canonical_products USING gin (search_vector);
CREATE INDEX canonical_products_embedding_idx ON canonical_products USING hnsw (text_embedding vector_cosine_ops) WHERE text_embedding IS NOT NULL;

ALTER TABLE scans
  ADD CONSTRAINT scans_selected_product_fk
  FOREIGN KEY (selected_product_id) REFERENCES canonical_products(id);

CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES canonical_products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  visual_signature text,
  image_embedding vector(1536),
  image_type text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_images_product_idx ON product_images (product_id);
CREATE INDEX product_images_embedding_idx ON product_images USING hnsw (image_embedding vector_cosine_ops) WHERE image_embedding IS NOT NULL;

CREATE TABLE merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  domain text NOT NULL UNIQUE,
  country_code char(2),
  provider text NOT NULL,
  provider_endpoint text,
  trust_score numeric(5,4),
  authorized_seller boolean,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE merchant_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_product_id uuid REFERENCES canonical_products(id),
  merchant_id uuid NOT NULL REFERENCES merchants(id),
  external_product_id text NOT NULL,
  external_variant_id text NOT NULL DEFAULT '',
  title text NOT NULL,
  product_url text,
  image_url text,
  price_minor bigint CHECK (price_minor IS NULL OR price_minor >= 0),
  currency char(3),
  availability text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, external_product_id, external_variant_id)
);

CREATE TABLE scan_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES canonical_products(id),
  retrieval_score numeric(6,5) NOT NULL,
  identifier_score numeric(6,5) NOT NULL DEFAULT 0,
  text_score numeric(6,5) NOT NULL DEFAULT 0,
  image_score numeric(6,5) NOT NULL DEFAULT 0,
  history_score numeric(6,5) NOT NULL DEFAULT 0,
  identity_score numeric(6,5),
  purchase_score numeric(6,5),
  classification text,
  matched_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  contradictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_id, product_id)
);

CREATE INDEX scan_candidates_scan_rank_idx ON scan_candidates (scan_id, rank);

CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  canonical_product_id uuid NOT NULL REFERENCES canonical_products(id),
  merchant_id uuid REFERENCES merchants(id),
  provider text NOT NULL,
  provider_offer_id text NOT NULL,
  external_product_id text NOT NULL,
  external_variant_id text NOT NULL,
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  shipping_minor bigint CHECK (shipping_minor IS NULL OR shipping_minor >= 0),
  tax_minor bigint CHECK (tax_minor IS NULL OR tax_minor >= 0),
  estimated_total_minor bigint NOT NULL CHECK (estimated_total_minor >= 0),
  currency char(3) NOT NULL,
  inventory_status text NOT NULL,
  identity_status text NOT NULL,
  identity_score numeric(6,5) NOT NULL,
  ranking_score numeric(6,5),
  ranking_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejected_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  illustrative boolean NOT NULL DEFAULT false,
  snapshot jsonb NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_id, provider, provider_offer_id)
);

CREATE INDEX offers_scan_rank_idx ON offers (scan_id, ranking_score DESC);

CREATE TABLE purchase_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  scan_id uuid NOT NULL REFERENCES scans(id),
  canonical_product_id uuid NOT NULL REFERENCES canonical_products(id),
  selected_offer_id uuid NOT NULL REFERENCES offers(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  max_authorized_amount_minor bigint NOT NULL CHECK (max_authorized_amount_minor >= 0),
  currency char(3) NOT NULL,
  shipping_address_id text,
  status text NOT NULL CHECK (status IN ('DRAFT', 'APPROVED', 'PAYMENT_SESSION_CREATED', 'CHECKOUT_IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED')),
  expires_at timestamptz NOT NULL,
  product_snapshot jsonb NOT NULL,
  offer_snapshot jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_intents_user_idx ON purchase_intents (user_id, created_at DESC);

CREATE TABLE payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_intent_id uuid NOT NULL REFERENCES purchase_intents(id),
  provider text NOT NULL,
  provider_session_id text NOT NULL UNIQUE,
  provider_order_id text,
  status text NOT NULL CHECK (status IN ('PENDING', 'AWAITING_RESULT', 'CHECKOUT_IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED', 'REVOKED')),
  expires_at timestamptz,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (purchase_intent_id)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  purchase_intent_id uuid NOT NULL UNIQUE REFERENCES purchase_intents(id),
  payment_session_id uuid NOT NULL UNIQUE REFERENCES payment_sessions(id),
  provider_order_id text,
  merchant_order_id text,
  merchant_name text NOT NULL,
  canonical_product_id uuid NOT NULL REFERENCES canonical_products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  subtotal_minor bigint,
  shipping_minor bigint,
  tax_minor bigint,
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  currency char(3) NOT NULL,
  status text NOT NULL CHECK (status IN ('CREATED', 'PAYMENT_APPROVED', 'MERCHANT_CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED', 'FAILED')),
  delivery_estimate jsonb,
  tracking jsonb,
  return_deadline timestamptz,
  product_snapshot jsonb NOT NULL,
  merchant_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'MERCHANT_CONFIRMED' OR merchant_order_id IS NOT NULL)
);

CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);

CREATE TABLE idempotency_records (
  key text PRIMARY KEY,
  operation text NOT NULL,
  owner_id text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('STARTED', 'COMPLETED', 'FAILED', 'UNKNOWN')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX idempotency_expiry_idx ON idempotency_records (expires_at);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'api', 'worker', 'provider', 'policy')),
  actor_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_entity_idx ON audit_events (entity_type, entity_id, created_at);

CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  region text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand, model, region)
);

CREATE TABLE compatibility_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES canonical_products(id),
  device_id uuid NOT NULL REFERENCES devices(id),
  compatibility_status text NOT NULL CHECK (compatibility_status IN ('compatible', 'incompatible', 'regional', 'unknown')),
  evidence_source text,
  evidence_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, device_id)
);

CREATE TABLE user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  device_id uuid REFERENCES devices(id),
  nickname text,
  serial_number_encrypted text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_purchase_preferences (
  user_id text PRIMARY KEY,
  exact_match_categories text[] NOT NULL DEFAULT '{}',
  allow_similar_categories text[] NOT NULL DEFAULT '{}',
  preferred_brands text[] NOT NULL DEFAULT '{}',
  blocked_brands text[] NOT NULL DEFAULT '{}',
  default_currency char(3),
  default_budget jsonb,
  merchant_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_product_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES canonical_products(id),
  scan_id uuid REFERENCES scans(id),
  confirmation_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scans_set_updated_at BEFORE UPDATE ON scans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER canonical_products_set_updated_at BEFORE UPDATE ON canonical_products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER merchants_set_updated_at BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER merchant_listings_set_updated_at BEFORE UPDATE ON merchant_listings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER purchase_intents_set_updated_at BEFORE UPDATE ON purchase_intents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payment_sessions_set_updated_at BEFORE UPDATE ON payment_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
