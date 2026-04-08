CREATE INDEX filter_search_index ON product ((document->'filter'->'customerId'), (document->'filter'->'siteId'), (document->'filter'->'channel'), (document->'meta'->'type'));
