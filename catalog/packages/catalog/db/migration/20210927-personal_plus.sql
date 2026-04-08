--Preconditions

-- Customers with multiple community tabletPackages as a result of converting from JP5 to JP6 sites
-- Set the jp5 packages status to Inactive in Protoss
-- Customers requiring this (As of 8/26/2021):
-- I-002570
-- I-003075
-- I-003227
-- I-003255
-- I-003300
-- I-301361
-- I-302729
-- I-303327

-- Customers with unique community packages, example special Law Community Tablets also Marketing sites
-- These Customers will be ignored in the migration script and will need Personal Packages created manually
-- I-003234
-- I-003298
-- I-003320
-- I-302789
-- I-302805
-- I-390023
-- I-999998

--Update existing personal tabletPackages with a paid subscription to personal+
--Set type to personal+ and also update the name from Subscriber/Subscription to Personal+
--Update audit history to include this update
WITH audit AS
    (UPDATE product SET document = jsonb_set(jsonb_set(document, '{meta, name}', to_jsonb(REGEXP_REPLACE(document->'meta'->>'name', 'Subscriber|Subscription', 'Personal+', 'gi'))) , '{meta, type}', '"personal+"')
        WHERE document->>'productTypeId' = 'tabletPackage'
            AND (document->'meta'->>'type' = 'personal' OR document->'meta'->>'type' = 'personal+')
            AND document->'meta'->'basePrice'->>'subscription' != '0'
        RETURNING product_id, document
    )
    INSERT INTO audit_history(action, entity_type, entity_id, context, document)
    SELECT 'UPDATE','product', audit.product_id, '{"reason": "Personal+ Migration"}', audit.document from audit;

-- Temporary table to hold and manipulate packages
CREATE TEMPORARY TABLE old_community(document JSONB);

-- Find community packages at locations with paid subscriptions(personal+)
INSERT INTO old_community (document)
    SELECT document FROM product
        WHERE document->>'productTypeId' = 'tabletPackage'
            AND document->'meta'->>'type' = 'community'
            AND document->>'status' = 'Active'
            AND document->'filter'#>>'{customerId,0}' IN -- Make sure this customerId also has a personal+ package
            (
                SELECT document->'filter'#>>'{customerId,0}' FROM product
                WHERE document->>'productTypeId' = 'tabletPackage'
                    AND document->'meta'->>'type' = 'personal+'
            )
            AND document->'filter'#>>'{customerId,0}' NOT IN -- Make sure this customerId only has one active community or personal package
            (
                SELECT document->'filter'#>>'{customerId,0}' FROM product
                    WHERE document->>'status' = 'Active'
                        AND (document->'meta'->>'type' = 'community' OR document->'meta'->>'type' = 'personal')
                        GROUP BY document->'filter'#>>'{customerId,0}'
                        HAVING COUNT(document->'filter'#>>'{customerId,0}') > 1
             );

-- Update community tablet to be a 0 dollar personal tablet that can't be ordered through makemine
UPDATE old_community SET document = jsonb_set(document, '{meta, name}', to_jsonb(REGEXP_REPLACE(document->'meta'->>'name', 'Community', 'Personal', 'gi')));
UPDATE old_community SET document = document - 'source';
UPDATE old_community SET document = jsonb_set(document, '{filter, channel}', to_jsonb(ARRAY['OrderingService']), TRUE);
UPDATE old_community SET document = jsonb_set(document, '{meta, type}', '"personal"');

-- Insert these new personal tabletPackages into product tablet, then use the new productIds to create audit history
WITH audit AS (INSERT INTO product (document) SELECT document FROM old_community RETURNING product_id, document)
INSERT INTO audit_history(action, entity_type, entity_id, context, document)
    SELECT 'CREATE','product', audit.product_id, '{"reason": "Personal+ Migration"}', audit.document FROM audit;

--Cleanup
DROP TABLE old_community;
