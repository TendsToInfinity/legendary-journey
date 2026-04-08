UPDATE product SET document = jsonb_set(document, '{meta, downloadAllowed}', 'true') 
WHERE document->>'productTypeId' IN ('tvEpisode', 'movie') 
AND document->'source'->>'vendorName' IN ('Pebblekick', 'Stadium')
AND document->'source'->>'licensed' = 'false'
AND document->'meta'->>'downloadAllowed' <> 'true';
