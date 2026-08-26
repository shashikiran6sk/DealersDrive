-- Sold cars stay on the marketplace.
--
-- Until now `listing_search` held exactly the cars a buyer could buy, so
-- "is it in the table" and "is it available" were the same question. A sold
-- car is now still *visible* — greyed out, badged, unclickable — but it is not
-- available, and every count in the product means available.
--
-- Splitting the two questions is therefore the whole of this migration:
-- membership stays `APPROVED-or-SOLD && dealer ACTIVE`, and `is_sold` carries
-- the difference. Every count query filters on it; see search.repository.ts,
-- where `buildWhere` adds the predicate by default and callers opt out.
ALTER TABLE listing_search
  ADD COLUMN is_sold boolean NOT NULL DEFAULT false,
  ADD COLUMN sold_at timestamptz;

-- Available cars are read on every search, facet and count; sold ones only
-- ever tail a result page. A partial index on the common case keeps the hot
-- path the same size it was before sold rows joined the table.
CREATE INDEX listing_search_available
  ON listing_search (city_slug, price_paise)
  WHERE is_sold = false;

CREATE INDEX listing_search_sold_recent
  ON listing_search (sold_at DESC)
  WHERE is_sold = true;
