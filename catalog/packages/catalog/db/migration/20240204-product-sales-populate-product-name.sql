-- Populate product sales product name from product if not exists
UPDATE product_sales ps
SET product_name = p.document->'meta'->>'name'
FROM product p
WHERE p.product_id = ps.product_id
AND ps.product_name IS NULL