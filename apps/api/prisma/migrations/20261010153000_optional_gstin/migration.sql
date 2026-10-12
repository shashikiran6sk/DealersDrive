BEGIN;
LOCK TABLE "dealers" IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE conflicts INTEGER; invalid INTEGER;
BEGIN
  SELECT count(*) INTO conflicts FROM (
    SELECT NULLIF(upper(btrim("gstin", E' \t\r\n\f' || chr(11))), '') AS value
    FROM "dealers" WHERE "gstin" IS NOT NULL
    GROUP BY 1 HAVING NULLIF(upper(btrim("gstin", E' \t\r\n\f' || chr(11))), '') IS NOT NULL AND count(*) > 1
  ) duplicates;
  SELECT count(*) INTO invalid FROM "dealers" WHERE NULLIF(upper(btrim("gstin", E' \t\r\n\f' || chr(11))), '') IS NOT NULL
    AND upper(btrim("gstin", E' \t\r\n\f' || chr(11))) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$';
  IF conflicts > 0 OR invalid > 0 THEN
    RAISE EXCEPTION 'GSTIN preflight failed: % conflicting canonical identities, % invalid legacy values. Review privately; no records changed.', conflicts, invalid;
  END IF;
END $$;
UPDATE "dealers" SET "gstin" = NULLIF(upper(btrim("gstin", E' \t\r\n\f' || chr(11))), '') WHERE "gstin" IS NOT NULL;
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_gstin_format_check" CHECK (
  "gstin" IS NULL OR "gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
);
COMMIT;
