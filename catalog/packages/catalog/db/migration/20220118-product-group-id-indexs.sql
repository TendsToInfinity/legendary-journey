--Update unique constraint on product.source for vendorProductId & vendorName & productTypeId.
DROP INDEX IF EXISTS product_group_idx;
CREATE UNIQUE INDEX product_group_idx ON product((document->'source'->>'vendorProductId'),(document->'source'->>'vendorName'), (document->'source'->>'productTypeId'));