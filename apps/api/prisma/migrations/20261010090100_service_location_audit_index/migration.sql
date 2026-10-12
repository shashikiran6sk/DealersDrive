-- Deliberately outside a transaction: existing audit writes remain available.
CREATE INDEX CONCURRENTLY "audit_logs_service_locations_history_idx"
ON "audit_logs" ("id" DESC)
WHERE "entityType" IN ('ServiceState', 'ServiceDistrict');
