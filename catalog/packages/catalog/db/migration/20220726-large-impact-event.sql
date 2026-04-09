DROP TABLE IF EXISTS large_impact_event;
CREATE TABLE IF NOT EXISTS large_impact_event (
   large_impact_event_id BIGSERIAL PRIMARY KEY,
   routing_key TEXT,
   payload JSONB,
   state TEXT default 'pending',
   cdate TIMESTAMPTZ,
   udate TIMESTAMPTZ,
   version INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS large_impact_event_id_udate_idx ON large_impact_event (routing_key, state, udate);

DROP TRIGGER IF EXISTS create_large_impact_event_timestamp ON large_impact_event;
CREATE TRIGGER create_large_impact_event_timestamp BEFORE INSERT ON large_impact_event FOR EACH ROW EXECUTE PROCEDURE create_timestamp();
DROP TRIGGER IF EXISTS update_large_impact_event_timestamp ON large_impact_event;
CREATE TRIGGER update_large_impact_event_timestamp BEFORE UPDATE ON large_impact_event FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
DROP TRIGGER IF EXISTS large_impact_event_version ON large_impact_event;
CREATE TRIGGER large_impact_event_version BEFORE UPDATE ON large_impact_event FOR EACH ROW EXECUTE PROCEDURE check_version_and_increment();
