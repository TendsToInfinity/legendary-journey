UPDATE product SET document = jsonb_set(document, '{meta, downloadAllowed}', 'false') WHERE document->>'productTypeId' IN ('tvEpisode', 'movie');
