UPDATE product
SET document = jsonb_set(
        document,
        '{meta, billingInterval}',
        '{"interval": "months", "count": 1 }',
        true
    )
WHERE document->'purchaseTypes'->>0 = 'subscription'
    AND not document->'meta' ? 'billingInterval';
    