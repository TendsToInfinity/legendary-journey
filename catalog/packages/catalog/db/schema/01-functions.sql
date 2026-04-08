CREATE FUNCTION update_product_tsv() RETURNS trigger AS $$
begin
  new.tsv :=
    setweight(to_tsvector('pg_catalog.english', coalesce(new.document->'meta'->>'name', '')), 'A') ||
    setweight(to_tsvector('pg_catalog.english', coalesce(new.document->'meta'->>'description', '')), 'B');
  return new;
end
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insert_product_id() RETURNS trigger AS $$
BEGIN
  NEW.document = jsonb_set(NEW.document, '{productId}', to_jsonb(NEW.product_id));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Recursively merges two jsonb objects. Similar but not identical to _.merge()
-- Note this does _not_ have any sort of array support.
-- Any comparisons that involve arrays will simply return the overriden value entirely,
-- and passing in an array as an argument to this function will result in an error (due to the jsonb_each() call).
CREATE FUNCTION jsonb_merge(object JSONB, source JSONB) RETURNS JSONB LANGUAGE SQL AS $$
SELECT coalesce(result.merged, '{}'::jsonb) FROM (
  SELECT
    jsonb_object_agg(coalesce(objKey, srcKey),
      CASE
        WHEN objValue isnull THEN srcValue
        WHEN srcValue isnull THEN objValue
        WHEN (jsonb_typeof(objValue) <> 'object' OR jsonb_typeof(srcValue) <> 'object') THEN srcValue
        ELSE jsonb_merge(objValue, srcValue)
      END
    ) merged
  FROM jsonb_each(object) e1(objKey, objValue) FULL OUTER JOIN jsonb_each(source) e2(srcKey, srcValue) ON objKey = srcKey
) result
$$;

-- to index date with btree index
CREATE OR REPLACE FUNCTION f_cast_isots(text)
  RETURNS timestamptz AS
  $$SELECT to_timestamp($1, 'YYYY-MM-DD HH24:MI')$$
LANGUAGE sql IMMUTABLE;