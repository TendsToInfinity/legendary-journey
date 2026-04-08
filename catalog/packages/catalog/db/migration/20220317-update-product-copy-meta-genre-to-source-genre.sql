UPDATE product 
SET document = jsonb_set(document, '{source, genres}',(document->'meta'->>'genres')::jsonb, true)
    WHERE document->'meta'->>'genres' IS NOT NULL
            AND document->'source'->>'genres' IS NULL
            AND document->>'productTypeId' in ('album', 'game', 'movie', 'track', 'tvEpisode', 'tvShow');