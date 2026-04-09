--- old future product changes were created without batch, which lead them to stuck after function update
UPDATE future_product_change
SET state = 'canceled'
WHERE state = 'processing' 