--Remove languages from tvEpisode meta
UPDATE product SET document = document #- '{meta,languages}' WHERE document->>'productTypeId' = 'tvEpisode';

UPDATE product SET document = jsonb_set(document, '{source, licensed}', 'true', true)
    WHERE document->'source'->>'vendorName' = 'swank'
    AND document->>'productTypeId' IN ('movie','tvEpisode');
