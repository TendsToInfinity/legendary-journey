UPDATE product SET document = jsonb_set(document, '{source, productTypeId}',concat('"', document->>'productTypeId', '"')::jsonb, true)
WHERE document->'source'->>'vendorProductId' IS NOT NULL AND document->'source'->>'vendorName' IS NOT NULL;
