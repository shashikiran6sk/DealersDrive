CREATE TABLE "contact_sharing_events" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL CHECK ("action" IN ('GRANT', 'WITHDRAW')),
    "purpose" TEXT NOT NULL,
    "dataCategories" TEXT[] NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "noticeDigest" TEXT NOT NULL CHECK ("noticeDigest" ~ '^[a-f0-9]{64}$'),
    "scopeDigest" TEXT NOT NULL CHECK ("scopeDigest" ~ '^[a-f0-9]{64}$'),
    "withdrawnGrantId" UUID,
    "eventKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_sharing_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sharing_action_scope" CHECK (("action" = 'GRANT' AND "withdrawnGrantId" IS NULL) OR ("action" = 'WITHDRAW' AND "withdrawnGrantId" IS NOT NULL)),
    CONSTRAINT "sharing_withdrawal_fkey" FOREIGN KEY ("withdrawnGrantId") REFERENCES "contact_sharing_events"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "contact_sharing_events_eventKey_key" ON "contact_sharing_events"("eventKey");
CREATE UNIQUE INDEX "contact_sharing_events_withdrawnGrantId_key" ON "contact_sharing_events"("withdrawnGrantId");
CREATE INDEX "contact_sharing_events_customerId_dealerId_scopeDigest_createdAt_idx" ON "contact_sharing_events"("customerId", "dealerId", "scopeDigest", "createdAt");
ALTER TABLE "enquiries" ADD COLUMN "sharingGrantId" UUID;
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_sharingGrantId_fkey" FOREIGN KEY ("sharingGrantId") REFERENCES "contact_sharing_events"("id") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "enquiries" VALIDATE CONSTRAINT "enquiries_sharingGrantId_fkey";

CREATE TRIGGER "contact_sharing_events_immutable"
BEFORE UPDATE OR DELETE ON "contact_sharing_events"
FOR EACH ROW EXECUTE FUNCTION prevent_legal_evidence_change();
CREATE TRIGGER "contact_sharing_events_no_truncate"
BEFORE TRUNCATE ON "contact_sharing_events"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_legal_evidence_change();

ALTER TABLE "legal_events" DROP CONSTRAINT "legal_event_action";
ALTER TABLE "legal_events" ADD CONSTRAINT "legal_event_action" CHECK ("action" IN ('ACCEPT','ACKNOWLEDGE','GRANT','WITHDRAW','CERTIFY','DISCLOSE')) NOT VALID;
ALTER TABLE "legal_events" VALIDATE CONSTRAINT "legal_event_action";
