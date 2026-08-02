CREATE TABLE ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  scan_id uuid REFERENCES scans(id) ON DELETE SET NULL,
  operation text NOT NULL,
  model text NOT NULL,
  provider_response_id text,
  status text NOT NULL CHECK (status IN ('RESERVED', 'SETTLED', 'RELEASED')),
  reserved_microusd bigint NOT NULL CHECK (reserved_microusd >= 0),
  actual_microusd bigint CHECK (actual_microusd IS NULL OR actual_microusd >= 0),
  input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  cached_input_tokens bigint NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  cache_write_input_tokens bigint NOT NULL DEFAULT 0 CHECK (cache_write_input_tokens >= 0),
  output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  reasoning_output_tokens bigint NOT NULL DEFAULT 0 CHECK (reasoning_output_tokens >= 0),
  total_tokens bigint NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  pricing_version text,
  failure_code text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  CHECK (
    (status = 'RESERVED' AND actual_microusd IS NULL AND settled_at IS NULL)
    OR (status IN ('SETTLED', 'RELEASED') AND settled_at IS NOT NULL)
  )
);

CREATE INDEX ai_usage_events_user_created_idx
  ON ai_usage_events (user_id, created_at DESC);

CREATE INDEX ai_usage_events_active_reservation_idx
  ON ai_usage_events (user_id, expires_at)
  WHERE status = 'RESERVED';

CREATE UNIQUE INDEX ai_usage_events_provider_response_idx
  ON ai_usage_events (provider_response_id)
  WHERE provider_response_id IS NOT NULL;
