CREATE INDEX IF NOT EXISTS pti ON product((document->>'productTypeId'), product_id);

-- order by startDate
CREATE INDEX IF NOT EXISTS pti_start_date_desc ON product((document->>'productTypeId'), (f_cast_isots(document->'meta'->>'startDate')) DESC NULLS LAST, product_id);
CREATE INDEX IF NOT EXISTS pti_start_date_desc_status ON product((document->>'productTypeId'), (f_cast_isots(document->'meta'->>'startDate')) DESC NULLS LAST, (document->>'status'), product_id);
CREATE INDEX IF NOT EXISTS pti_start_date_asc ON product((document->>'productTypeId'), (f_cast_isots(document->'meta'->>'startDate')), product_id);
CREATE INDEX IF NOT EXISTS pti_start_date_asc_status ON product((document->>'productTypeId'), (f_cast_isots(document->'meta'->>'startDate')), (document->>'status'), product_id);

-- order by name
CREATE INDEX IF NOT EXISTS pti_name_desc ON product((document->>'productTypeId'), (document->'meta'->>'name') DESC NULLS LAST, product_id);
CREATE INDEX IF NOT EXISTS pti_name_desc_status ON product((document->>'productTypeId'), (document->'meta'->>'name')  DESC NULLS LAST, (document->>'status'), product_id);
CREATE INDEX IF NOT EXISTS pti_name_asc ON product((document->>'productTypeId'), (document->'meta'->>'name'), product_id);
CREATE INDEX IF NOT EXISTS pti_name_asc_status ON product((document->>'productTypeId'), (document->'meta'->>'name'), (document->>'status'), product_id);

-- order by year
CREATE INDEX IF NOT EXISTS pti_year_desc ON product((document->>'productTypeId'), (f_cast_isots(document->'meta'->>'year')) DESC NULLS LAST, product_id);
CREATE INDEX IF NOT EXISTS pti_year_desc_status ON product((document->>'productTypeId'), (f_cast_isots(document->'meta'->>'year')) DESC NULLS LAST, (document->>'status'), product_id);
CREATE INDEX IF NOT EXISTS pti_year_asc ON product((document->>'productTypeId'), (f_cast_isots(document->'meta'->>'year')), product_id);
CREATE INDEX IF NOT EXISTS pti_year_asc_status ON product((document->>'productTypeId'), (f_cast_isots(document->'meta'->>'year')), (document->>'status'), product_id);

-- order by purchase price
CREATE INDEX IF NOT EXISTS pti_purchase_desc ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'purchase') DESC NULLS LAST, product_id);
CREATE INDEX IF NOT EXISTS pti_purchase_status_desc ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'purchase') DESC NULLS LAST, (document->>'status'), product_id);
CREATE INDEX IF NOT EXISTS pti_purchase ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'purchase'), product_id);
CREATE INDEX IF NOT EXISTS pti_purchase_status ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'purchase'), (document->>'status'), product_id);

-- order by purchase subscription
CREATE INDEX IF NOT EXISTS pti_subscription_desc ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'subscription') DESC NULLS LAST, product_id);
CREATE INDEX IF NOT EXISTS pti_subscription_status_desc ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'subscription') DESC NULLS LAST, (document->>'status'), product_id);
CREATE INDEX IF NOT EXISTS pti_subscription ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'subscription'), product_id);
CREATE INDEX IF NOT EXISTS pti_subscription_status ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'subscription'), (document->>'status'), product_id);

-- order by purchase rental
CREATE INDEX IF NOT EXISTS pti_rental_desc ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'rental') DESC NULLS LAST, product_id);
CREATE INDEX IF NOT EXISTS pti_rental_status_desc ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'rental') DESC NULLS LAST, (document->>'status'), product_id);
CREATE INDEX IF NOT EXISTS pti_rental ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'rental'), product_id);
CREATE INDEX IF NOT EXISTS pti_rental_status ON product((document->>'productTypeId'), (document->'meta'->'basePrice'->>'rental'), (document->>'status'), product_id);

-- new gin for fuzzy search
DROP INDEX IF EXISTS product_meta_name_idx;

-- to index date with btree index
CREATE OR REPLACE FUNCTION f_cast_isots(text)
  RETURNS timestamptz AS
  $$SELECT to_timestamp($1, 'YYYY-MM-DD HH24:MI')$$
LANGUAGE sql IMMUTABLE;

CREATE INDEX IF NOT EXISTS product_meta_name_idx_gin ON product USING gin((document->'meta'->>'name') gin_trgm_ops);
