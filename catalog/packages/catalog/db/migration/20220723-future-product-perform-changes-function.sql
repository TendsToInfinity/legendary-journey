CREATE OR REPLACE FUNCTION future_product_perform_changes() 
RETURNS SETOF product AS $$

BEGIN

CREATE temp TABLE if not EXISTS product_change (
        future_product_change_id integer,
        new_document jsonb,
        product_id bigint,
        action_date timestamp with time zone
) ON COMMIT DELETE rows;

INSERT INTO
    product_change
SELECT
    future_product_change_id,
    Jsonb_merge(document, action) AS new_document,
    p.product_id,
    action_date
FROM
    future_product_change fpc
    LEFT JOIN product p ON p.document ->> 'productTypeId' = fpc.product_type_id
    AND p.document -> 'source' ->> 'vendorName' = fpc.vendor_name
    AND p.document -> 'source' ->> 'vendorProductId' = fpc.vendor_product_id
WHERE
    state = 'pending'
    AND action_date <= CURRENT_DATE
LIMIT
    100;

--- here we need to update the future_product_change table, set state to progress
UPDATE
    future_product_change fpc
SET
    state = 'processing'
FROM
    product_change pc
WHERE
    pc.future_product_change_id = fpc.future_product_change_id;

--- here we need to update the product table
BEGIN

RETURN QUERY UPDATE
    product p
SET
    document = pc.new_document
FROM
    product_change pc
WHERE
    pc.product_id IS NOT NULL
    AND p.product_id = pc.product_id
RETURNING p.*;

--- here we need to update the audit_history table
INSERT INTO
    audit_history (
        action,
        entity_type,
        entity_id,
        context,
        document
    )
SELECT
    'UPDATE',
    'product',
    pc.product_id,
    (
        '{"source": "FUTURE_PRODUCT_CHANGE", "future_product_change_id": "' || pc.future_product_change_id || '"}'
    ) :: jsonb,
    row_to_json(p)::jsonb
FROM
    product_change pc
JOIN product p ON p.product_id=pc.product_id
WHERE
    pc.product_id IS NOT NULL;

--- here we need to update the future_product_change table, set state to progress
UPDATE
    future_product_change fpc
SET
    state = 'complete',
    product_id = pc.product_id
FROM
    product_change pc
WHERE
    pc.product_id IS NOT NULL
    AND pc.future_product_change_id = fpc.future_product_change_id;

--- here we need to update the future_product_change table, set state to error for not found products
UPDATE
    future_product_change fpc
SET
    state = 'error',
    error = 'Unable to find product using vendorProductId and vendorName'
FROM
    product_change pc
WHERE
    pc.product_id IS NULL
    AND pc.future_product_change_id = fpc.future_product_change_id;

-- commit changes
END;

 
END$$ LANGUAGE plpgsql;