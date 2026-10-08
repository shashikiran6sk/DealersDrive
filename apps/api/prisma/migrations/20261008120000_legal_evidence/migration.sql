CREATE TABLE "legal_events" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" UUID NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "legal_event_action" CHECK ("action" IN ('ACCEPT','ACKNOWLEDGE','GRANT','WITHDRAW','CERTIFY')),
  CONSTRAINT "legal_event_subject" CHECK ("subjectType" IN ('USER','DEALER','LISTING','ENQUIRY')),
  CONSTRAINT "legal_event_digest" CHECK ("digest" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "legal_events_eventKey_key" ON "legal_events"("eventKey");
CREATE INDEX "legal_events_subjectType_subjectId_documentId_createdAt_idx"
  ON "legal_events"("subjectType","subjectId","documentId","createdAt");
CREATE INDEX "legal_events_actorId_createdAt_idx" ON "legal_events"("actorId","createdAt");
CREATE FUNCTION prevent_legal_evidence_change() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Legal evidence is append-only; use reviewed privileged retention maintenance';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER legal_evidence_immutable BEFORE UPDATE OR DELETE ON "legal_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_legal_evidence_change();
ALTER TABLE "enquiries" ADD COLUMN "sharingWithdrawnAt" TIMESTAMP(3);
CREATE TRIGGER legal_evidence_no_truncate BEFORE TRUNCATE ON "legal_events"
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_legal_evidence_change();
