DROP TABLE IF EXISTS digest;
CREATE TABLE digest (
  product_id                BIGINT,
  product_type_id           TEXT NOT NULL,
  rule_ids                  INT[],
  available_globally        BOOLEAN,
  whitelist_customer_ids    TEXT[] DEFAULT ARRAY[]::TEXT[],
  blacklist_customer_ids    TEXT[] DEFAULT ARRAY[]::TEXT[],
  whitelist_site_ids        TEXT[] DEFAULT ARRAY[]::TEXT[],
  blacklist_site_ids        TEXT[] DEFAULT ARRAY[]::TEXT[],
  subscription_product_ids  BIGINT[] DEFAULT ARRAY[]::BIGINT[],
  version                   INT DEFAULT 0,
  cdate                     TIMESTAMPTZ,
  udate                     TIMESTAMPTZ
);
-- INSERT INTO digest (product_id, product_type_id, rule_ids, available_globally, whitelist_customer_ids, blacklist_customer_ids, whitelist_site_ids, blacklist_site_ids, subscription_product_ids, version, cdate, udate)
-- SELECT product_id, document->>'productTypeId', ARRAY[]::INT[], false, ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::BIGINT[], 0, NOW(), NOW() FROM product;

ALTER TABLE DIGEST ADD CONSTRAINT digest_pkey PRIMARY KEY (product_id);
CREATE TRIGGER create_digest_timestamp BEFORE INSERT ON digest FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_digest_timestamp BEFORE UPDATE ON digest FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER digest_version BEFORE UPDATE ON digest FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();
