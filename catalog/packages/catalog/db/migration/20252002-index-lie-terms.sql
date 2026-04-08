
-- 3M in QA, 0 in PROD
DELETE FROM block_reason
WHERE block_reason_id in (
	SELECT block_reason_id
	FROM block_reason
	WHERE blocked_by_product = product_id
)