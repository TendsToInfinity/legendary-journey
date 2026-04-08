--Add product_type_group_id column to product_type and populate
ALTER TABLE product_type ADD COLUMN IF NOT EXISTS product_type_group_id TEXT;
UPDATE product_type SET product_type_group_id= product_type_id;
UPDATE product_type SET product_type_group_id='tv' WHERE product_type_id = ANY(ARRAY['tvEpisode', 'tvSeason', 'tvShow']);

--Add productTypeGroupId to document and populate
UPDATE product SET document = document || '{"productTypeGroupId": "tabletPackage"}' WHERE document->>'productTypeId' = 'tabletPackage';
UPDATE product SET document = document || '{"productTypeGroupId": "apk"}' WHERE document->>'productTypeId' = 'apk';
UPDATE product SET document = document || '{"productTypeGroupId": "movie"}' WHERE document->>'productTypeId' = 'movie';
UPDATE product SET document = document || '{"productTypeGroupId": "accessory"}' WHERE document->>'productTypeId' = 'accessory';
UPDATE product SET document = document || '{"productTypeGroupId": "device"}' WHERE document->>'productTypeId' = 'device';
UPDATE product SET document = document || '{"productTypeGroupId": "newsStand"}' WHERE document->>'productTypeId' = 'newsStand';
UPDATE product SET document = document || '{"productTypeGroupId": "tv"}' WHERE document->>'productTypeId' = 'tvEpisode';
UPDATE product SET document = document || '{"productTypeGroupId": "tv"}' WHERE document->>'productTypeId' = 'tvSeason';
UPDATE product SET document = document || '{"productTypeGroupId": "tv"}' WHERE document->>'productTypeId' = 'tvShow';

--Clear out empty source data to allow unique index creation
UPDATE product SET document = document - 'source' WHERE document->'source'->>'vendorProductId' IS NULL OR document->'source'->>'vendorProductId' = '';
--Add unique constraint on product.source for vendorProductId & vendorName
CREATE UNIQUE INDEX IF NOT EXISTS product_group_idx ON product((document->'source'->>'vendorProductId'),(document->'source'->>'vendorName'));