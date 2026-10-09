BEGIN;

-- No destructive remediation: ambiguous ownership must be reviewed before rollout.
LOCK TABLE "users", "dealers", "dealer_members", "oauth_identities" IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION dd_canonical_email(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(btrim(value, E' \t\n\r\f' || chr(11) || chr(160) || chr(5760)
    || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197)
    || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202)
    || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279))), '');
$$;

DO $$
DECLARE conflicts bigint;
BEGIN
  SELECT count(*) INTO conflicts FROM (
    SELECT dd_canonical_email("email") FROM "users"
    WHERE dd_canonical_email("email") IS NOT NULL
    GROUP BY dd_canonical_email("email") HAVING count(*) > 1
  ) duplicates;
  IF conflicts > 0 THEN
    RAISE EXCEPTION 'Email migration blocked: % conflicting account email groups. Review canonical identities; no records were changed.', conflicts;
  END IF;

  SELECT count(*) INTO conflicts FROM (
    SELECT "dealerId" FROM "dealer_members" WHERE "role" = 'OWNER' AND "status" = 'ACTIVE'
    GROUP BY "dealerId" HAVING count(*) > 1
  ) duplicates;
  IF conflicts > 0 THEN
    RAISE EXCEPTION 'Email migration blocked: % dealerships have multiple active owners. Review primary ownership; no records were changed.', conflicts;
  END IF;
END $$;

ALTER TABLE "dealers" ADD COLUMN "primaryOwnerEmail" TEXT;

CREATE FUNCTION dd_primary_dealer_email(dealer_id uuid, previous_email text, contact_email text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE owner_id uuid; identity_email text; account_email text;
BEGIN
  SELECT m."userId", u."email" INTO owner_id, account_email
  FROM "dealer_members" m JOIN "users" u ON u."id" = m."userId"
  WHERE m."dealerId" = dealer_id AND m."role" = 'OWNER' AND m."status" = 'ACTIVE';

  IF owner_id IS NOT NULL THEN
    SELECT "email" INTO identity_email FROM "oauth_identities"
    WHERE "userId" = owner_id AND "provider" = 'GOOGLE' AND "emailVerified" = true
    AND dd_canonical_email("email") IS NOT NULL
    ORDER BY "createdAt", "id" LIMIT 1;
    RETURN COALESCE(dd_canonical_email(identity_email), dd_canonical_email(account_email), dd_canonical_email(previous_email), dd_canonical_email(contact_email));
  END IF;
  RETURN COALESCE(dd_canonical_email(contact_email), dd_canonical_email(previous_email));
END $$;

UPDATE "dealers" SET "primaryOwnerEmail" = dd_primary_dealer_email("id", NULL, "contactEmail");

DO $$
DECLARE conflicts bigint;
BEGIN
  SELECT count(*) INTO conflicts FROM (
    SELECT "primaryOwnerEmail" FROM "dealers" WHERE "primaryOwnerEmail" IS NOT NULL
    GROUP BY "primaryOwnerEmail" HAVING count(*) > 1
  ) duplicates;
  IF conflicts > 0 THEN
    RAISE EXCEPTION 'Email migration blocked: % conflicting primary dealer email groups. Review declarations and verified owners; no records were changed.', conflicts;
  END IF;
END $$;

CREATE UNIQUE INDEX "dealers_primaryOwnerEmail_key" ON "dealers" ("primaryOwnerEmail");
CREATE UNIQUE INDEX "dealer_members_one_active_owner" ON "dealer_members" ("dealerId")
WHERE "role" = 'OWNER' AND "status" = 'ACTIVE';
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_primary_owner_email_canonical"
CHECK ("primaryOwnerEmail" IS NULL OR ("primaryOwnerEmail" <> '' AND "primaryOwnerEmail" = dd_canonical_email("primaryOwnerEmail")));

UPDATE "users" SET "email" = dd_canonical_email("email") WHERE "email" IS NOT NULL;
UPDATE "oauth_identities" SET "email" = COALESCE(dd_canonical_email("email"), '');
UPDATE "dealers" SET "contactEmail" = dd_canonical_email("contactEmail") WHERE "contactEmail" IS NOT NULL;

CREATE FUNCTION dd_normalise_user_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."email" := dd_canonical_email(NEW."email");
  RETURN NEW;
END $$;
CREATE TRIGGER "users_normalise_email" BEFORE INSERT OR UPDATE OF "email" ON "users"
FOR EACH ROW EXECUTE FUNCTION dd_normalise_user_email();

CREATE FUNCTION dd_normalise_oauth_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."email" := COALESCE(dd_canonical_email(NEW."email"), '');
  RETURN NEW;
END $$;
CREATE TRIGGER "oauth_normalise_email" BEFORE INSERT OR UPDATE OF "email" ON "oauth_identities"
FOR EACH ROW EXECUTE FUNCTION dd_normalise_oauth_email();

CREATE FUNCTION dd_derive_dealer_email() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_email text;
BEGIN
  IF TG_OP = 'UPDATE' THEN previous_email := OLD."primaryOwnerEmail"; END IF;
  NEW."contactEmail" := dd_canonical_email(NEW."contactEmail");
  NEW."primaryOwnerEmail" := dd_primary_dealer_email(NEW."id", previous_email, NEW."contactEmail");
  RETURN NEW;
END $$;
CREATE TRIGGER "dealers_derive_primary_email" BEFORE INSERT OR UPDATE OF "contactEmail", "primaryOwnerEmail" ON "dealers"
FOR EACH ROW EXECUTE FUNCTION dd_derive_dealer_email();

CREATE FUNCTION dd_refresh_member_dealer_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD."role" = 'OWNER' THEN
    UPDATE "dealers" SET "primaryOwnerEmail" = "primaryOwnerEmail" WHERE "id" = OLD."dealerId";
  END IF;
  IF TG_OP <> 'DELETE' AND NEW."role" = 'OWNER' THEN
    UPDATE "dealers" SET "primaryOwnerEmail" = "primaryOwnerEmail" WHERE "id" = NEW."dealerId";
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER "dealer_members_refresh_primary_email" AFTER INSERT OR UPDATE OR DELETE ON "dealer_members"
FOR EACH ROW EXECUTE FUNCTION dd_refresh_member_dealer_email();

CREATE FUNCTION dd_refresh_user_dealer_email() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE person_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    person_id := NEW."id";
  ELSE
    IF TG_OP <> 'INSERT' THEN
      UPDATE "dealers" d SET "primaryOwnerEmail" = d."primaryOwnerEmail"
      WHERE EXISTS (SELECT 1 FROM "dealer_members" m WHERE m."dealerId" = d."id"
        AND m."userId" = OLD."userId" AND m."role" = 'OWNER' AND m."status" = 'ACTIVE');
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN NULL; END IF;
    person_id := NEW."userId";
  END IF;
  UPDATE "dealers" d SET "primaryOwnerEmail" = d."primaryOwnerEmail"
  WHERE EXISTS (SELECT 1 FROM "dealer_members" m WHERE m."dealerId" = d."id"
    AND m."userId" = person_id AND m."role" = 'OWNER' AND m."status" = 'ACTIVE');
  RETURN NULL;
END $$;
CREATE TRIGGER "users_refresh_primary_email" AFTER UPDATE OF "email" ON "users"
FOR EACH ROW EXECUTE FUNCTION dd_refresh_user_dealer_email();
CREATE TRIGGER "oauth_refresh_primary_email" AFTER INSERT OR UPDATE OF "email", "emailVerified", "userId", "provider" OR DELETE ON "oauth_identities"
FOR EACH ROW EXECUTE FUNCTION dd_refresh_user_dealer_email();

COMMIT;
