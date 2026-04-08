CREATE INDEX CONCURRENTLY IF NOT EXISTS dpv_genre_update_concurent_idx ON product USING BTREE (
    LOWER(document->'source'->>'genres'::TEXT),
    LOWER(document->'meta'->>'genres'::TEXT),
    (document->>'productTypeGroupId')
);