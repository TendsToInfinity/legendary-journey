UPDATE product
SET document = jsonb_set(
   document::jsonb,
    '{meta,multipleSubscription}',
    'false'::jsonb,
    true
)
WHERE document->>'productTypeId' IN (
    'gameSubscription',
    'movieSubscription',
    'musicSubscription',
    'ebookSubscription'
);
