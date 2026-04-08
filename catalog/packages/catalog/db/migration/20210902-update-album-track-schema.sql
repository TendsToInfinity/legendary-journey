-- Remove records from product where productTypeId is album or track

DELETE FROM product
WHERE document->>'productTypeId' in ('album', 'track');
