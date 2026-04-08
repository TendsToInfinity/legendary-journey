CREATE TABLE IF NOT EXISTS future_product_change
(
  future_product_change_id  BIGSERIAL PRIMARY KEY,
  product_id                BIGINT,
  product_type_id           TEXT NOT NULL,
  vendor_product_id         TEXT NOT NULL,
  action_date               TIMESTAMPTZ NOT NULL,
  vendor_name               TEXT NOT NULL,
  state                     TEXT NOT NULL,
  error                     TEXT,
  action                    JSONB,
  version                   INT DEFAULT 0,
  cdate                     TIMESTAMPTZ,
  udate                     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS future_product_change_action_idx ON future_product_change USING gin(action);
CREATE INDEX IF NOT EXISTS future_product_change_product_id_idx ON future_product_change (product_id);
CREATE INDEX IF NOT EXISTS future_vendor_product_id_date_idx ON future_product_change (product_type_id, vendor_product_id, vendor_name, action_date);

DROP TRIGGER IF EXISTS create_future_product_timestamp ON future_product_change;
CREATE TRIGGER create_future_product_timestamp BEFORE INSERT ON future_product_change FOR EACH ROW EXECUTE PROCEDURE create_timestamp();

DROP TRIGGER IF EXISTS update_future_product_timestamp ON future_product_change;
CREATE TRIGGER update_future_product_timestamp BEFORE UPDATE ON future_product_change FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

DROP TRIGGER IF EXISTS future_product_version ON future_product_change;
CREATE TRIGGER future_product_version BEFORE UPDATE ON future_product_change FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();
