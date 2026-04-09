DO $$ BEGIN
  -- For trigram matching (`%` operator) in ProductDao.
  IF NOT EXISTS (SELECT FROM pg_available_extensions WHERE name = 'pg_trgm' AND installed_version IS NOT NULL) THEN CREATE EXTENSION pg_trgm; END IF;
  -- For use of `uniq()` in ProductDao.
  IF NOT EXISTS (SELECT FROM pg_available_extensions WHERE name = 'intarray' AND installed_version IS NOT NULL) THEN CREATE EXTENSION intarray; END IF;
END $$;

CREATE TABLE product_type
(
  product_type_id       TEXT PRIMARY KEY,
  product_type_group_id TEXT,
  subscribable          BOOLEAN DEFAULT false,
  version               INT DEFAULT 0,
  purchase_code         TEXT,
  purchase_types        TEXT[],
  fulfillment_type      TEXT,
  json_schema           JSONB,
  available             BOOLEAN,
  meta                  JSONB,
  cdate                 TIMESTAMPTZ,
  udate                 TIMESTAMPTZ
);
CREATE TRIGGER create_pt_timestamp BEFORE INSERT ON product_type FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_pt_timestamp BEFORE UPDATE ON product_type FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER product_type_version BEFORE UPDATE ON product_type FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();

CREATE TABLE product
(
  product_id        BIGSERIAL PRIMARY KEY,
  version           INT DEFAULT 0,
  document          JSONB,
  tsv               tsvector,
  cdate             TIMESTAMPTZ,
  udate             TIMESTAMPTZ
);

CREATE INDEX lower_document_idx ON product USING gin ((lower(document::text)::jsonb));
CREATE INDEX product_fts_idx ON product USING gin(tsv);
CREATE INDEX IF NOT EXISTS product_meta_name_idx_gin ON product USING gin((document->'meta'->>'name') gin_trgm_ops);
CREATE UNIQUE INDEX product_group_idx ON product((document->'source'->>'vendorProductId'),(document->'source'->>'vendorName'), (document->'source'->>'productTypeId'));
CREATE INDEX IF NOT EXISTS product_type_id_idx ON product((document->>'productTypeId'));

CREATE TRIGGER update_product_tsv BEFORE INSERT OR UPDATE ON product FOR EACH ROW EXECUTE PROCEDURE update_product_tsv();
CREATE TRIGGER create_product_timestamp BEFORE INSERT ON product FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_product_timestamp BEFORE UPDATE ON product FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER product_version BEFORE UPDATE ON product FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();
CREATE TRIGGER product_id_indoc BEFORE INSERT ON product FOR EACH ROW EXECUTE PROCEDURE insert_product_id();

CREATE TABLE rule
(
  rule_id         SERIAL PRIMARY KEY,
  version         INT DEFAULT 0,
  customer_id     CHAR(8),
  site_id         CHAR(5),
  product_type_id TEXT REFERENCES product_type (product_type_id),
  product_id      BIGINT REFERENCES product (product_id) ON DELETE CASCADE,
  name            TEXT,
  type            TEXT,
  enabled         BOOLEAN,
  clauses         JSONB[],
  action          JSONB,
  cdate           TIMESTAMPTZ,
  udate           TIMESTAMPTZ
);

CREATE INDEX rule_search on rule (customer_id, site_id, type, enabled);

CREATE TRIGGER create_rule_timestamp BEFORE INSERT ON rule FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_rule_timestamp BEFORE UPDATE ON rule FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER rule_version BEFORE UPDATE ON rule FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();

CREATE TABLE homepage
(
  homepage_id     BIGSERIAL PRIMARY KEY,
  version         INT DEFAULT 0,
  product_type_id TEXT REFERENCES product_type (product_type_id),
  display_name    TEXT,
  rank            INT,
  search          JSONB,
  cdate           TIMESTAMPTZ,
  udate           TIMESTAMPTZ
);
CREATE TRIGGER create_homepage_timestamp BEFORE INSERT ON homepage FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_homepage_timestamp BEFORE UPDATE ON homepage FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER homepage_version BEFORE UPDATE ON homepage FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();

CREATE TABLE fee
(
  fee_id          BIGSERIAL PRIMARY KEY,
  version         INT DEFAULT 0,
  customer_id     CHAR(8),
  site_id         CHAR(5),
  product_type_id TEXT REFERENCES product_type (product_type_id),
  name            TEXT,
  amount          NUMERIC(8,2),
  percent         BOOLEAN,
  clauses         JSONB[],
  enabled         BOOLEAN DEFAULT true,
  cdate           TIMESTAMPTZ,
  udate           TIMESTAMPTZ
);
CREATE TRIGGER create_fee_timestamp BEFORE INSERT ON fee FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_fee_timestamp BEFORE UPDATE ON fee FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER fee_version BEFORE UPDATE ON fee FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();

CREATE TABLE IF NOT EXISTS distinct_product_value
(
  distinct_product_value_id  BIGSERIAL PRIMARY KEY,
  field_path                 TEXT NOT NULL,
  product_type_group_id      TEXT NOT NULL,
  source_value_name          TEXT NOT NULL,
  display_name               TEXT NOT NULL,
  cdate                      TIMESTAMPTZ,
  udate                      TIMESTAMPTZ
);

CREATE TRIGGER create_distinct_product_value_timestamp BEFORE INSERT ON distinct_product_value FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_distinct_product_value_timestamp BEFORE UPDATE ON distinct_product_value FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE INDEX distinct_product_field_product_group_source_name_lower_idx ON distinct_product_value (lower(field_path), lower(source_value_name),lower(product_type_group_id));
CREATE UNIQUE INDEX dpv_unique_values_idx ON distinct_product_value(field_path, product_type_group_id, source_value_name);

CREATE TABLE blocklist_term
(
  blocklist_term_id             BIGSERIAL PRIMARY KEY,
  term                          TEXT NOT NULL,
  enabled                       BOOLEAN,
  product_type_group_id         TEXT NOT NULL,
  cdate                         TIMESTAMPTZ,
  udate                         TIMESTAMPTZ,
  UNIQUE(term, product_type_group_id)
);
CREATE TRIGGER create_blocklist_terms_timestamp BEFORE INSERT ON blocklist_term FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_blocklist_terms_timestamp BEFORE UPDATE ON blocklist_term FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE UNIQUE INDEX blocklist_term_idx ON blocklist_term(enabled, term, product_type_group_id);

CREATE TABLE IF NOT EXISTS block_action
(
  block_action_id               BIGSERIAL PRIMARY KEY,
  type                          TEXT,
  blocklist_term_ids            BIGINT[],
  product_id                    BIGINT REFERENCES product (product_id) ON DELETE CASCADE,
  manually_blocked_reason       TEXT,
  state                         TEXT DEFAULT 'pending',
  action                        TEXT,
  error_description             TEXT,
  cdate                         TIMESTAMPTZ,
  udate                         TIMESTAMPTZ
);
CREATE TRIGGER create_block_action_timestamp BEFORE INSERT ON block_action FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_block_action_timestamp BEFORE UPDATE ON block_action FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TABLE IF NOT EXISTS block_reason
(
  block_reason_id                       BIGSERIAL PRIMARY KEY,
  product_id                            BIGINT REFERENCES product (product_id) ON DELETE CASCADE,
  term_id                               BIGINT REFERENCES blocklist_term (blocklist_term_id) ON DELETE CASCADE,
  term                                  TEXT,
  block_action_id                       BIGINT REFERENCES block_action (block_action_id) ON DELETE CASCADE,
  manually_blocked_reason               TEXT,
  blocked_by_product                    BIGINT REFERENCES product (product_id) ON DELETE CASCADE,
  is_active                             BOOLEAN,
  is_manually_blocked                   BOOLEAN,
  cdate                                 TIMESTAMPTZ,
  udate                                 TIMESTAMPTZ
);
CREATE TRIGGER create_block_reason_timestamp BEFORE INSERT ON block_reason FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_block_reason_timestamp BEFORE UPDATE ON block_reason FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- index for finding products not blocked by term

CREATE INDEX IF NOT EXISTS block_reason_term_id_idx ON block_reason (term_id);
CREATE INDEX IF NOT EXISTS block_reason_term_idx ON block_reason (term_id, block_action_id);
-- index for finding products not blocked by product
CREATE INDEX IF NOT EXISTS block_reason_product_idx ON block_reason (blocked_by_product, block_action_id);
CREATE INDEX IF NOT EXISTS block_reason_product_id_idx ON block_reason (product_id);

-- performace optimization

CREATE INDEX IF NOT EXISTS pti ON product((document->>'productTypeId'), product_id);
CREATE INDEX IF NOT EXISTS product_name_lower_idx ON product USING gin ((lower((document -> 'meta'::text) ->> 'name'::text)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS pti_vendor_artist_idx ON product((document->'source'->>'vendorArtistId'), (document->>'productTypeId'));

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

-- music subscription rules
CREATE INDEX IF NOT EXISTS pti_music_subscription_rule_idx ON product((document->>'productTypeId'), (document->'source'->>'availableForSubscription'), (document->'source'->>'parentLabelName'), (document->'meta'->>'releaseYear'), product_id);

CREATE TABLE future_product_change
(
  future_product_change_id  BIGSERIAL PRIMARY KEY,
  product_id                BIGINT,
  product_type_id           TEXT NOT NULL,
  vendor_product_id         TEXT NOT NULL,
  action_date               TIMESTAMPTZ NOT NULL,
  vendor_name               TEXT NOT NULL,
  state                     TEXT NOT NULL,
  error                     TEXT,
  ingestion_batch_id        TEXT,
  action                    JSONB,
  version                   INT DEFAULT 0,
  cdate                     TIMESTAMPTZ,
  udate                     TIMESTAMPTZ
);

CREATE INDEX future_product_change_action_idx ON future_product_change USING gin(action);
CREATE INDEX future_product_change_product_id_idx ON future_product_change (product_id);
CREATE INDEX future_vendor_product_id_date_lower_idx ON future_product_change (lower(vendor_product_id), lower(product_type_id), lower(vendor_name), action_date);
CREATE INDEX future_product_change_state_idx ON future_product_change (lower(state));

CREATE TRIGGER create_future_product_timestamp BEFORE INSERT ON future_product_change FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_future_product_timestamp BEFORE UPDATE ON future_product_change FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER future_product_version BEFORE UPDATE ON future_product_change FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();

CREATE TABLE large_impact_event (
   large_impact_event_id BIGSERIAL PRIMARY KEY,
   routing_key TEXT,
   payload JSONB,
   state TEXT default 'pending',
   cdate TIMESTAMPTZ,
   udate TIMESTAMPTZ,
   version INT DEFAULT 0
);

CREATE INDEX large_impact_event_id_udate_idx ON large_impact_event (routing_key, state, udate);

CREATE TRIGGER create_large_impact_event_timestamp BEFORE INSERT ON large_impact_event FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_large_impact_event_timestamp BEFORE UPDATE ON large_impact_event FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER large_impact_event_version BEFORE UPDATE ON large_impact_event FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();

CREATE TABLE IF NOT EXISTS product_sales
(
  product_sales_id BIGSERIAL PRIMARY KEY,
  product_type_group_id TEXT NOT NULL,
  product_type_id TEXT NOT NULL,
  purchase_type TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  product_id BIGINT NOT NULL REFERENCES product (product_id) ON DELETE CASCADE,
  parent_product_id BIGINT,
  artist_product_id BIGINT,
  product_name TEXT,
  completed_orders INT,
  year INT,
  month INT,
  day INT,
  version INT DEFAULT 0,
  cdate TIMESTAMPTZ,
  udate TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sales_product_date_brin_idx  on product_sales using brin (cdate);
CREATE UNIQUE INDEX IF NOT EXISTS product_sales_unique_idx ON product_sales(product_type_group_id, product_type_id, purchase_type, customer_id, product_id, year, month, day);
CREATE INDEX IF NOT EXISTS product_sales_product_id_idx ON product_sales(product_id);

CREATE TRIGGER create_sales_product_timestamp BEFORE INSERT ON product_sales FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
CREATE TRIGGER update_sales_product_timestamp BEFORE UPDATE ON product_sales FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER sales_product_version BEFORE UPDATE ON product_sales FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();
