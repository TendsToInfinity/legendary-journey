-- Remove case sensitive entries for meta.genres
DELETE FROM distinct_product_value WHERE field_path = 'meta.genres' AND lower(source_value_name) != source_value_name;
