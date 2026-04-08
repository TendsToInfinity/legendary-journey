CREATE INDEX CONCURRENTLY IF NOT EXISTS block_reason_product_idx ON block_reason (blocked_by_product, block_action_id);
