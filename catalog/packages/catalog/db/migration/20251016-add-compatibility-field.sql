-- Adds a field 'compatibility' to existing APK products
UPDATE product
SET document = jsonb_set(document, '{meta,compatibility}', '[]':: jsonb, true)
WHERE (document ->> 'productTypeId') = 'apk'
  AND (document -> 'meta' -> 'compatibility') IS NULL;