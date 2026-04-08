-- Remove any duplicates if they exist before creating the index
DELETE FROM distinct_product_value a
WHERE EXISTS (
    SELECT * FROM distinct_product_value x
    WHERE x.field_path = a.field_path
    AND x.product_type_group_id = a.product_type_group_id
    AND x.source_value_name = a.source_value_name
    AND x.display_name  = a.display_name
    AND x.distinct_product_value_id < a.distinct_product_value_id
 );

--Add unique constraint on distinct_product_value for field_path, product_type_group_id, and source_value_name
CREATE UNIQUE INDEX IF NOT EXISTS dpv_unique_values_idx ON distinct_product_value(field_path, product_type_group_id, source_value_name);
