BEGIN;

CREATE TABLE "legal_acceptances" (
  "id" UUID NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "dealerId" UUID,
  "termsVersion" TEXT NOT NULL,
  "privacyVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "legal_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "legal_acceptances_subject_check" CHECK (
    ("dealerId" IS NULL AND "subjectKey" = 'USER:' || "userId"::text) OR
    ("dealerId" IS NOT NULL AND "subjectKey" = 'DEALER:' || "dealerId"::text)
  ),
  CONSTRAINT "legal_acceptances_versions_check" CHECK (
    "termsVersion" ~ '^terms-v[0-9]+\.[0-9]+$' AND
    "privacyVersion" ~ '^privacy-v[0-9]+\.[0-9]+$'
  )
);
CREATE UNIQUE INDEX "legal_acceptances_subjectKey_termsVersion_privacyVersion_key"
  ON "legal_acceptances"("subjectKey", "termsVersion", "privacyVersion");
CREATE INDEX "legal_acceptances_userId_idx" ON "legal_acceptances"("userId");

CREATE FUNCTION protect_legal_acceptance_v1() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Legal acceptance is immutable; retention maintenance requires explicit review';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "legal_acceptances_immutable" BEFORE UPDATE OR DELETE ON "legal_acceptances"
  FOR EACH ROW EXECUTE FUNCTION protect_legal_acceptance_v1();
CREATE TRIGGER "legal_acceptances_no_truncate" BEFORE TRUNCATE ON "legal_acceptances"
  FOR EACH STATEMENT EXECUTE FUNCTION protect_legal_acceptance_v1();

COMMIT;
