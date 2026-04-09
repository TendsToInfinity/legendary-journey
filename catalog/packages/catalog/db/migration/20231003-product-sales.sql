CREATE TABLE IF NOT EXISTS product_sales
(
  product_sales_id BIGSERIAL PRIMARY KEY,
  product_type_group_id TEXT NOT NULL,
  product_type_id TEXT NOT NULL, 
  purchase_type TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  product_id BIGINT NOT NULL REFERENCES product (product_id) ON DELETE CASCADE,
  parent_product_id BIGINT,
  artist_product_id BIGINT, 
  product_name TEXT,
  completed_orders INT,
  year INT,
  month INT,
  day INT,
  version INT DEFAULT 0,
  cdate TIMESTAMPTZ,
  udate TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sales_product_date_brin_idx  on product_sales using brin (cdate); 
CREATE UNIQUE INDEX IF NOT EXISTS product_sales_unique_idx ON product_sales(product_type_group_id, product_type_id, purchase_type, customer_id, product_id, year, month, day);
CREATE INDEX IF NOT EXISTS product_sales_product_id_idx ON product_sales(product_id);

DROP TRIGGER IF EXISTS create_sales_product_timestamp ON product_sales;
CREATE TRIGGER create_sales_product_timestamp BEFORE INSERT ON product_sales FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
DROP TRIGGER IF EXISTS update_sales_product_timestamp ON product_sales;
CREATE TRIGGER update_sales_product_timestamp BEFORE UPDATE ON product_sales FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
DROP TRIGGER IF EXISTS sales_product_version ON product_sales;
CREATE TRIGGER sales_product_version BEFORE UPDATE ON product_sales FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();