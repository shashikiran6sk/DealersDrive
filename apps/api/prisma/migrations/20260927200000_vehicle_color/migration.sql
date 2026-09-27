-- A car's colour becomes one of twelve generic families (R52).
--
-- `vehicles.color` was free text, so "Fiery Red", "Flame Red" and "red" were
-- three filter options for one colour and the search's colour facet grew with
-- every shade a dealer typed. The column is now the `VehicleColor` enum.
--
-- Nothing is thrown away. The typed text moves to `legacyColor`, which nothing
-- writes and nothing public reads, so the backfill below can be audited — or
-- redone with a better rule — from the original words.
--
-- The backfill is deliberately conservative, and is the same rule as
-- `normaliseVehicleColor` in `packages/contracts/src/enums.ts`:
--
--   * exactly one family named  -> that family   ("Pearl White" -> WHITE)
--   * none, or more than one    -> OTHER         ("Deep Forest", "Red with black roof")
--   * blank                     -> NULL
--
-- A wrong colour files a car where a buyer will not look for it; Other does not.
-- `dd_vehicle_color` stays in the schema so the integration suite can hold it
-- to the TypeScript rule, word for word.

CREATE TYPE "VehicleColor" AS ENUM (
  'BLACK', 'WHITE', 'GREY', 'SILVER', 'RED', 'BLUE',
  'GREEN', 'BROWN', 'BEIGE', 'YELLOW', 'ORANGE', 'OTHER'
);

ALTER TABLE "vehicles" RENAME COLUMN "color" TO "legacyColor";
ALTER TABLE "vehicles" ADD COLUMN "color" "VehicleColor";

CREATE FUNCTION dd_vehicle_color(raw TEXT) RETURNS "VehicleColor"
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN NULL
    WHEN upper(btrim(raw)) IN (
      'BLACK', 'WHITE', 'GREY', 'SILVER', 'RED', 'BLUE',
      'GREEN', 'BROWN', 'BEIGE', 'YELLOW', 'ORANGE', 'OTHER'
    ) THEN upper(btrim(raw))::"VehicleColor"
    WHEN cardinality(families) = 1 THEN families[1]::"VehicleColor"
    ELSE 'OTHER'::"VehicleColor"
  END
  FROM (
    SELECT array_remove(ARRAY[
      CASE WHEN raw ~* '\m(black)\M' THEN 'BLACK' END,
      CASE WHEN raw ~* '\m(white)\M' THEN 'WHITE' END,
      CASE WHEN raw ~* '\m(grey|gray)\M' THEN 'GREY' END,
      CASE WHEN raw ~* '\m(silver)\M' THEN 'SILVER' END,
      CASE WHEN raw ~* '\m(red|maroon)\M' THEN 'RED' END,
      CASE WHEN raw ~* '\m(blue|navy)\M' THEN 'BLUE' END,
      CASE WHEN raw ~* '\m(green)\M' THEN 'GREEN' END,
      CASE WHEN raw ~* '\m(brown)\M' THEN 'BROWN' END,
      CASE WHEN raw ~* '\m(beige)\M' THEN 'BEIGE' END,
      CASE WHEN raw ~* '\m(yellow)\M' THEN 'YELLOW' END,
      CASE WHEN raw ~* '\m(orange)\M' THEN 'ORANGE' END
    ], NULL) AS families
  ) AS matched
$$;

UPDATE "vehicles" SET "color" = dd_vehicle_color("legacyColor") WHERE "legacyColor" IS NOT NULL;
