CREATE TABLE IF NOT EXISTS subscription_reference
(
  subscription_reference_id     SERIAL PRIMARY KEY,
  subscription_product_id       INT REFERENCES product (product_id) ON DELETE CASCADE,
  member_product_id             INT REFERENCES product (product_id) ON DELETE CASCADE,
  cdate                         TIMESTAMPTZ,
  udate                         TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS create_subscription_reference_timestamp ON subscription_reference;
CREATE TRIGGER create_subscription_reference_timestamp BEFORE INSERT ON subscription_reference FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE INDEX IF NOT EXISTS subscription_product_idx on subscription_reference (subscription_product_id);
CREATE INDEX IF NOT EXISTS member_product_idx on subscription_reference (member_product_id);
