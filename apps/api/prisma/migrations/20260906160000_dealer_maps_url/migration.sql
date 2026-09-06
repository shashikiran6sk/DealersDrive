-- Where the yard is, as the dealer's own Google Maps link.
--
-- Text, not coordinates. A share link survives the dealer moving their pin,
-- carries the place's name and reviews with it, and opens the Maps app rather
-- than a web map on a phone — none of which a `lat,lng` pair extracted at write
-- time would do. `dealers.lat` / `dealers.lng` stay unwritten and unread; the
-- distance sort that needs them is geocoding's problem, not this column's.
--
-- Nullable, and no backfill: every dealership that already exists was created
-- before the question was asked, and there is nothing to guess from. The
-- completeness check names it, which is how a dealer is asked to fill it in.
--
-- No index. Nothing filters or joins on a share link — it is read by id,
-- alongside the rest of the profile, and rendered as one anchor.

ALTER TABLE "dealers" ADD COLUMN "mapsUrl" TEXT;
