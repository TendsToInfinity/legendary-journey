-- add new columns
ALTER TABLE fee ADD COLUMN IF NOT EXISTS clauses JSONB[];
ALTER TABLE fee ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

-- update existing records to enabled true
UPDATE fee SET enabled= true;
-- update existing record's clauses to {}
UPDATE fee set clauses='{}'::jsonb[];
