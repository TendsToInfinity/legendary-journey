ALTER TABLE product_type ADD COLUMN IF NOT EXISTS meta JSONB;
ALTER TABLE product_type ADD COLUMN IF NOT EXISTS version INT DEFAULT 0;
DROP TRIGGER IF EXISTS product_type_version ON product_type;
CREATE TRIGGER product_type_version BEFORE UPDATE ON product_type FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();
