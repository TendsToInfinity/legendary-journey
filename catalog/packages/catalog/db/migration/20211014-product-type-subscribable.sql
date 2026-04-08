ALTER TABLE product_type ADD COLUMN IF NOT EXISTS subscribable BOOLEAN DEFAULT false;
UPDATE product_type SET subscribable = true WHERE product_type_id  in ('gameSubscription', 'movieSubscription', 'tvSubscription');


--Update subscribable to true for the productTypeId belonging to Subscription.

UPDATE product SET document = jsonb_set(document, '{subscribable}', 'true') WHERE document->>'productTypeId' in ('gameSubscription', 'movieSubscription', 'tvSubscription');
