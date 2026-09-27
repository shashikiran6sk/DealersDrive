-- The marketplace search (F076) filters and counts on the vehicle's make and
-- model: `brand=hyundai` is `make IN (...)`, and the brand and model facets
-- group by the pair.
--
-- The one index the search adds, deliberately. Every other filter and every
-- sort is evaluated over the ACTIVE listings the existing
-- `listings(status, publishedAt)` index already finds, joined to their vehicles
-- by primary key; an index on price, year or distance would be read only when
-- that range is more selective than "live", which it is not. The make is the
-- filter a buyer narrows by first, and the one worth reaching directly.

CREATE INDEX "vehicles_make_model_idx" ON "vehicles"("make", "model");
