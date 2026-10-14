CREATE TABLE "legal_policy_versions" (
  "id" UUID NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "digest" TEXT NOT NULL CHECK ("digest" ~ '^[a-f0-9]{64}$'),
  "publicationState" TEXT NOT NULL CHECK ("publicationState" IN ('DRAFT', 'PUBLISHED')),
  "effectiveAt" TIMESTAMP(3),
  "approvalReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_policy_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "legal_policy_publication_review" CHECK ("publicationState" = 'DRAFT' OR ("effectiveAt" IS NOT NULL AND length(trim("approvalReference")) > 0 AND "version" NOT LIKE '%draft%'))
);
CREATE UNIQUE INDEX "legal_policy_versions_documentId_version_key" ON "legal_policy_versions"("documentId", "version");
CREATE TRIGGER "legal_policy_versions_immutable" BEFORE UPDATE OR DELETE ON "legal_policy_versions"
  FOR EACH ROW EXECUTE FUNCTION prevent_legal_evidence_change();
CREATE TRIGGER "legal_policy_versions_no_truncate" BEFORE TRUNCATE ON "legal_policy_versions"
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_legal_evidence_change();

INSERT INTO "legal_policy_versions" ("id", "documentId", "version", "digest", "publicationState") VALUES ('79f3dbe6-54e7-4ad6-8947-4b58c9292888', 'terms', '1.0-draft.1', '15b73644d5de54fe97568de70e676570abf2baa55cb7c0f83313f853c98ec059', 'DRAFT');
INSERT INTO "legal_policy_versions" ("id", "documentId", "version", "digest", "publicationState") VALUES ('5381e792-15df-489c-83d0-cddbbdd42490', 'privacy', '1.0-draft.1', '9ef6be3661e5a3fa57151d125b4a7e74b7a9ca6f50df32434652f639df3165ba', 'DRAFT');
INSERT INTO "legal_policy_versions" ("id", "documentId", "version", "digest", "publicationState") VALUES ('20dada91-c82a-4d7c-baab-ee257658e26d', 'dealer', '1.0-draft.1', 'b0d63029194bdfe2d7de6872502bf64c3ea1412a553da2619d4daf2453577fd2', 'DRAFT');
INSERT INTO "legal_policy_versions" ("id", "documentId", "version", "digest", "publicationState") VALUES ('78fb2fef-3104-44ad-9e45-c448077e0658', 'listing', '1.0-draft.1', '0a36f39814b964b39635e86acafa4f1c4cd982c3d8e3ca5050842b0e7229364e', 'DRAFT');
INSERT INTO "legal_policy_versions" ("id", "documentId", "version", "digest", "publicationState") VALUES ('07a88a5c-9783-4616-94be-052b5ec7a248', 'grievance', '1.0-draft.1', '8c7a47c071ac7cacf6514c4b1c8949674a57fe4572326dcb807ec2fbb0ad1566', 'DRAFT');
INSERT INTO "legal_policy_versions" ("id", "documentId", "version", "digest", "publicationState") VALUES ('d9529f2d-c89f-4c24-b979-be93ad929deb', 'rights', '1.0-draft.1', '069ed5bfe8a660110408fd8c2a02ac62e322bc2b20e8c8629362f0437f3ccf64', 'DRAFT');
INSERT INTO "legal_policy_versions" ("id", "documentId", "version", "digest", "publicationState") VALUES ('4b5a98d3-30a0-4774-b5ef-da71d22ba421', 'terms', '2.0-draft.1', '5b515afb339c5ad0cad63b9d1a007eb71521c3b721f51e12ac628d6d1e3d637d', 'DRAFT');
INSERT INTO "legal_policy_versions" ("id", "documentId", "version", "digest", "publicationState") VALUES ('532a95bd-72c8-442d-9206-228b0f549e9d', 'privacy', '2.0-draft.1', '36a5e8533b44470bf0248c56e3eef678b682e553d57fb10bc4905e1486838335', 'DRAFT');
