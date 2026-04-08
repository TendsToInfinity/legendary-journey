-- The table schema was diferent before this script was written and that schema was deployed until production.
-- as result of that the tables are dropped and recreated.

DROP TABLE IF EXISTS blocklist_term CASCADE;
DROP TABLE IF EXISTS block_action CASCADE;
DROP TABLE IF EXISTS block_reason CASCADE;
DROP TABLE IF EXISTS distinct_product_value CASCADE;


CREATE TABLE IF NOT EXISTS blocklist_term
(
  blocklist_term_id             BIGSERIAL PRIMARY KEY,
  term                          TEXT,
  enabled                       BOOLEAN,
  state                         TEXT DEFAULT 'pending',
  cdate                         TIMESTAMPTZ,
  udate                         TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS create_blocklist_terms_timestamp ON blocklist_term;
CREATE TRIGGER create_blocklist_terms_timestamp BEFORE INSERT ON blocklist_term FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
DROP TRIGGER IF EXISTS update_blocklist_terms_timestamp ON blocklist_term;
CREATE TRIGGER update_blocklist_terms_timestamp BEFORE UPDATE ON blocklist_term FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TABLE IF NOT EXISTS block_action
(
  block_action_id               BIGSERIAL PRIMARY KEY,
  type                          TEXT,
  blocklist_term_ids            BIGINT[],
  product_id                    BIGINT REFERENCES product (product_id) ON DELETE CASCADE,
  manually_blocked_reason       TEXT,
  state                         TEXT DEFAULT 'pending',
  action                        TEXT,
  error_description             TEXT,
  cdate                         TIMESTAMPTZ,
  udate                         TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS create_block_action_timestamp ON block_action;
CREATE TRIGGER create_block_action_timestamp BEFORE INSERT ON block_action FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
DROP TRIGGER IF EXISTS update_block_action_timestamp ON block_action;
CREATE TRIGGER update_block_action_timestamp BEFORE UPDATE ON block_action FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TABLE IF NOT EXISTS block_reason
(
  block_reason_id                       BIGSERIAL PRIMARY KEY,
  product_id                            BIGINT REFERENCES product (product_id) ON DELETE CASCADE,
  term_id                               BIGINT REFERENCES blocklist_term (blocklist_term_id) ON DELETE CASCADE,
  term                                  TEXT,
  block_action_id                       BIGINT REFERENCES block_action (block_action_id) ON DELETE CASCADE,
  manually_blocked_reason               TEXT,
  is_active                             BOOLEAN,
  is_manually_blocked                   BOOLEAN,
  cdate                                 TIMESTAMPTZ,
  udate                                 TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS create_block_reason_timestamp ON block_reason;
CREATE TRIGGER create_block_reason_timestamp BEFORE INSERT ON block_reason FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
DROP TRIGGER IF EXISTS update_block_reason_timestamp ON block_reason;
CREATE TRIGGER update_block_reason_timestamp BEFORE UPDATE ON block_reason FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TABLE IF NOT EXISTS distinct_product_value
(
  distinct_product_value_id  BIGSERIAL PRIMARY KEY,
  field_path                 TEXT NOT NULL,
  product_type_group_id      TEXT NOT NULL,
  source_value_name          TEXT NOT NULL,
  display_name               TEXT NOT NULL,
  cdate                      TIMESTAMPTZ,
  udate                      TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS create_distinct_product_value_timestamp ON distinct_product_value;
CREATE TRIGGER create_distinct_product_value_timestamp BEFORE INSERT ON distinct_product_value FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
DROP TRIGGER IF EXISTS update_distinct_product_value_timestamp ON distinct_product_value;
CREATE TRIGGER update_distinct_product_value_timestamp BEFORE UPDATE ON distinct_product_value FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE INDEX distinct_product_field_product_group_source_name_lower_idx ON distinct_product_value (lower(field_path), lower(source_value_name),lower(product_type_group_id));
