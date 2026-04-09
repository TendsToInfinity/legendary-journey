ALTER TABLE product_type ADD COLUMN IF NOT EXISTS fulfillment_type TEXT;
-- Update digital fulfillment for apk, movie, newsStand, tvEpisode
UPDATE product SET document = jsonb_set(document, '{fulfillmentType}', '"digital"', true) WHERE document->>'productTypeId' in ('apk', 'movie', 'newsStand', 'tvEpisode');
UPDATE product_type SET fulfillment_type = '"digital"' WHERE product_type_id in ('apk', 'movie', 'newsStand', 'tvEpisode');
-- Update physical fulfillment for tabletPackage
UPDATE product SET document = jsonb_set(document, '{fulfillmentType}', '"physical"', true) WHERE document->>'productTypeId' in ('tabletPackage');
UPDATE product_type SET fulfillment_type = '"physical"' WHERE product_type_id in ('tabletPackage');
