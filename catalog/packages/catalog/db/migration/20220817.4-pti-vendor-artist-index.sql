CREATE INDEX CONCURRENTLY IF NOT EXISTS pti_vendor_artist_idx ON product((document->'source'->>'vendorArtistId'), (document->>'productTypeId'));
