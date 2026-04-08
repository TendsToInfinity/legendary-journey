--Default premiumContent to false
UPDATE product SET document = jsonb_set(document, '{meta, premiumContent}', 'false') WHERE document->>'productTypeId' = 'tabletPackage';

--Update premium content to true when the package contains mediastore in it's child products
UPDATE product SET document = jsonb_set(document, '{meta, premiumContent}', 'true')
    WHERE document->>'productTypeId' = 'tabletPackage'
    AND (
        SELECT product_id FROM product
            WHERE document->>'productTypeId' = 'apk'
            AND document->'meta'->>'androidClass' = 'net.securustech.sv.mediastore'
    ) = ANY(TRANSLATE(document#>>'{childProductIds}', '[]','{}')::INT[]);
