CREATE INDEX CONCURRENTLY IF NOT EXISTS product_name_lower_idx ON product USING gin ((lower((document -> 'meta'::text) ->> 'name'::text)) gin_trgm_ops);
