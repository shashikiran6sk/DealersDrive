-- The public address of a listing (F075, F082).
--
-- Minted at the first approval from the car's year, make, model, variant and
-- the dealership's town, plus a random suffix; the vehicle page lives at
-- /car/{slug}. It is the only identifier a buyer is ever given — no listing,
-- vehicle or dealer id appears in a public response.

ALTER TABLE "listings" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "listings_slug_key" ON "listings"("slug");

-- A listing already live before this column existed gets an opaque address
-- derived from nothing a buyer could reverse.
UPDATE "listings"
SET "slug" = 'car-' || substr(md5(random()::text || "id"::text), 1, 12)
WHERE "slug" IS NULL AND "status" IN ('ACTIVE', 'SOLD');
