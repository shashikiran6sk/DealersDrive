-- Things Prisma's schema language cannot express, and which the architecture
-- says the database — not application code — must guarantee.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ───────────────────────────────────────────────────────────────────────────
-- §11.1 — the denormalized read model. Only APPROVED listings from ACTIVE
-- dealers ever enter this table. That single rule is the whole visibility
-- model, and every count in the product is derived from it.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE listing_search (
  listing_id        uuid PRIMARY KEY,
  vehicle_id        uuid NOT NULL,
  dealer_id         uuid NOT NULL,
  dealer_name       text NOT NULL,
  dealer_slug       text NOT NULL,
  dealer_initials   text NOT NULL,
  make_slug text, model_slug text, variant_slug text,
  make_name text, model_name text, variant_name text,
  title             text NOT NULL,
  vehicle_slug      text NOT NULL,
  year int, price_paise bigint, km int,
  fuel text, transmission text, body_type text, owner_number int,
  seats int, airbags int,
  color_slug text, color_family text,
  rto_code text, rto_state text,
  city_slug text, city_name text, lat float8, lng float8,
  features text[] NOT NULL DEFAULT '{}',
  photo_count       int NOT NULL DEFAULT 0,
  primary_media_id  uuid,
  primary_blurhash  text,
  approved_at       timestamptz,
  search_doc tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(make_name,'')),  'A') ||
    setweight(to_tsvector('simple', coalesce(model_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(variant_name,'')),'B') ||
    setweight(to_tsvector('simple', coalesce(city_name,'')),  'C') ||
    setweight(to_tsvector('simple', coalesce(dealer_name,'')),'D')
  ) STORED
);

CREATE INDEX listing_search_doc_idx      ON listing_search USING GIN (search_doc);
CREATE INDEX listing_search_features_idx ON listing_search USING GIN (features);
CREATE INDEX listing_search_city_price   ON listing_search (city_slug, price_paise);
CREATE INDEX listing_search_make_model   ON listing_search (make_slug, model_slug, year);
CREATE INDEX listing_search_price_recent ON listing_search (price_paise, approved_at DESC);
CREATE INDEX listing_search_color        ON listing_search (color_family);
CREATE INDEX listing_search_rto          ON listing_search (rto_state, rto_code);
CREATE INDEX listing_search_seats        ON listing_search (seats);
CREATE INDEX listing_search_airbags      ON listing_search (airbags);
CREATE INDEX listing_search_dealer       ON listing_search (dealer_slug);
CREATE INDEX listing_search_trgm         ON listing_search USING GIN (
  (coalesce(make_name,'') || ' ' || coalesce(model_name,'')) gin_trgm_ops
);

-- ───────────────────────────────────────────────────────────────────────────
-- §6 — invariants the application must not be trusted with.
-- ───────────────────────────────────────────────────────────────────────────

-- One live listing per vehicle. Enforced by the database, not by a service.
CREATE UNIQUE INDEX listings_one_approved_per_vehicle
  ON listings ("vehicleId") WHERE status = 'APPROVED';

-- An APPROVED listing without an expiry date is a data-integrity bug (§10).
ALTER TABLE listings ADD CONSTRAINT approved_has_expiry
  CHECK (status <> 'APPROVED' OR "expiresAt" IS NOT NULL);

-- §26.8 — a dealer's balance can never go negative, whatever the service does.
ALTER TABLE dealers ADD CONSTRAINT credit_balance_non_negative
  CHECK ("creditBalance" >= 0);
ALTER TABLE dealers ADD CONSTRAINT credits_held_non_negative
  CHECK ("creditsHeld" >= 0);

-- A zero-delta ledger row is legal for exactly one reason: CONSUME_APPROVE,
-- where the debit already happened at hold time but the dealer still needs to
-- see the publication event in their history (§26.3).
ALTER TABLE credit_transactions ADD CONSTRAINT ledger_delta_meaningful
  CHECK (delta <> 0 OR reason = 'CONSUME_APPROVE');

-- §8.1 — dealers are passwordless. A non-admin row with a password hash is a
-- bug; there is a test for it, and now a constraint too.
ALTER TABLE users ADD CONSTRAINT only_admins_have_passwords
  CHECK ("passwordHash" IS NULL OR "isPlatformAdmin" = true);

-- ───────────────────────────────────────────────────────────────────────────
-- §14.2 — the buyer-facing enquiry reference. Short, speakable over a phone,
-- stable. Platform-wide, so it leaks no per-dealer volume.
-- ───────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE enquiry_reference_seq START WITH 10000;

-- §26.5 — invoice numbers, one sequence per financial year in production;
-- one sequence is sufficient at this volume and the FY is in the number.
CREATE SEQUENCE invoice_number_seq START WITH 1;
