-- R93 — one login reaches every dealership a person belongs to.
--
-- Additive: one nullable column. Every existing session reads NULL, which
-- means "the person's oldest dealership" — exactly what it meant before.
ALTER TABLE "sessions" ADD COLUMN "activeDealerId" UUID;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_activeDealerId_fkey"
  FOREIGN KEY ("activeDealerId") REFERENCES "dealers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
