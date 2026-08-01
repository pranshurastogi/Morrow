CREATE TABLE user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
  encrypted_payload jsonb NOT NULL,
  country_code char(2) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX user_addresses_user_idx
  ON user_addresses (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX user_addresses_one_default_idx
  ON user_addresses (user_id)
  WHERE is_default AND deleted_at IS NULL;

CREATE TRIGGER user_addresses_set_updated_at
  BEFORE UPDATE ON user_addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
