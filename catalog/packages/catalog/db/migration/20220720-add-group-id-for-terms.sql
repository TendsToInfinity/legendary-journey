ALTER TABLE blocklist_term ADD COLUMN IF NOT EXISTS product_type_group_id TEXT NOT NULL;
ALTER TABLE block_reason ADD COLUMN IF NOT EXISTS blocked_by_product BIGINT REFERENCES product (product_id) ON DELETE CASCADE;
ALTER TABLE blocklist_term ADD CONSTRAINT blocklist_term_idx UNIQUE (term, product_type_group_id);
