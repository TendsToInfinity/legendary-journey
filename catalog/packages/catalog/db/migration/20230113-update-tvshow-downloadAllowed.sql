-- Default all tvShow downloadAllowed flags to false and update audit
WITH audit AS (
    UPDATE product SET document = jsonb_set(document, '{meta, downloadAllowed}', 'false')
    WHERE document->>'productTypeId' = 'tvShow'
    RETURNING product_id, document
)
INSERT INTO audit_history(action, entity_type, entity_id, context, document)
SELECT 'UPDATE','product', audit.product_id, '{"reason": "Add downloadAllowed flag"}', audit.document from audit;

-- Update tvShow downloadAllowed flag to true if a tvEpisode exists for this show with downloadAllowed true, update audit history too
WITH audit AS (
    UPDATE product SET document = jsonb_set(document, '{meta, downloadAllowed}', 'true')
        WHERE document->>'productTypeId' = 'tvShow'
        AND document->'source'->>'vendorProductId' IN (
            SELECT document->>'tmdbShowId' FROM product
            WHERE document->>'productTypeId' = 'tvEpisode'
            AND document->'meta'->>'downloadAllowed' = 'true'
        )
        RETURNING product_id, document
)
INSERT INTO audit_history(action, entity_type, entity_id, context, document)
SELECT 'UPDATE','product', audit.product_id, '{"reason": "Update downloadAllowed migration"}', audit.document from audit;
