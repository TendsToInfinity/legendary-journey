CREATE INDEX IF NOT EXISTS lower_document_idx ON product USING gin ((lower(document::text)::jsonb));
CREATE INDEX IF NOT EXISTS rule_search on rule (customer_id, site_id, type, enabled);