-- Update product sales month values to their correct 1-12 range
UPDATE product_sales ps
SET month = (DATE_PART('Month', cdate))::INT
