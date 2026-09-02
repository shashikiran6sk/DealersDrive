-- The vehicle history report: point-in-time records checks.
--
-- Separate from the rc_lookup migration so the published report can be rolled
-- back without losing the intake work, which is the more valuable half and the
-- half with no legal surface.
--
-- ## Append-only
--
-- Every fetch writes a NEW row. Nothing updates one. That is not tidiness — it
-- is the answer to "your page said this car was clear". A published report is a
-- claim made on a date, and an updated-in-place row cannot reproduce what a
-- buyer actually saw.
--
-- ## What has no column here
--
-- Owner name, violator or driver name, mobile number, place of offence, chassis
-- number, engine number, lender name. All are present in the provider response
-- and all are stripped in attestr.adapter.ts before the domain sees them. The
-- absence of a column is the enforcement.
CREATE TABLE "vehicle_reports" (
    "id"        UUID         NOT NULL,
    "vehicleId" UUID         NOT NULL,
    -- Denormalised so tenant filtering stays one indexed predicate (§7).
    "dealerId"  UUID         NOT NULL,
    -- A report is only as good as its source; after a provider switch we need
    -- to know which rows came from where.
    "provider"  TEXT         NOT NULL,
    -- The moment the provider answered. This is the `asOf` a buyer is shown,
    -- and it is the whole of the claim's honesty.
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "blacklistStatus"  "BlacklistStatus" NOT NULL DEFAULT 'UNKNOWN',
    "blacklistReasons" TEXT[],
    -- A state, never a person: "NOC issued to Karnataka".
    "nocIssuedTo"      TEXT,

    -- FALSE when the state's challan feed returned nothing. Distinct from a
    -- zero count, and rendered as "unavailable" rather than "clear": an absent
    -- feed presented as a clean record is the worst failure this table has.
    "challansAvailable"       BOOLEAN NOT NULL DEFAULT false,
    "challanCount"            INTEGER NOT NULL DEFAULT 0,
    "challanUnpaidCount"      INTEGER NOT NULL DEFAULT 0,
    "challanOutstandingPaise" BIGINT  NOT NULL DEFAULT 0,
    -- Itemised, PII already stripped. JSONB rather than a table: they are read
    -- as a block with their parent report and never queried across.
    "challans"                JSONB   NOT NULL DEFAULT '[]',

    -- Whether a loan is on record. The lender's name is the owner's banking
    -- relationship and is never stored.
    "financed" BOOLEAN,

    "rcStatus"      TEXT,
    "insuranceUpto" TIMESTAMP(3),
    "fitnessUpto"   TIMESTAMP(3),
    "pucUpto"       TIMESTAMP(3),
    "taxUpto"       TIMESTAMP(3),

    -- Set when this row was the one live on a public listing page. Null for
    -- rows only ever seen by the dealer.
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "vehicle_reports_pkey" PRIMARY KEY ("id")
);

-- "The current report for this vehicle" is the only hot read; DESC makes it a
-- single index seek rather than a sort.
CREATE INDEX "vehicle_reports_vehicleId_fetchedAt_idx"
  ON "vehicle_reports"("vehicleId", "fetchedAt" DESC);
CREATE INDEX "vehicle_reports_dealerId_fetchedAt_idx"
  ON "vehicle_reports"("dealerId", "fetchedAt");

ALTER TABLE "vehicle_reports"
  ADD CONSTRAINT "vehicle_reports_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
