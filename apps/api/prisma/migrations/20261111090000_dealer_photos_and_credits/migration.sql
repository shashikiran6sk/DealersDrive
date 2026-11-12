-- Dealer photographs and listing credits.
--
-- Every statement is additive: new enums, new tables, three new listing
-- columns with constant defaults, and CHECK constraints that every existing
-- row already satisfies (nothing has ever written a credit balance). The
-- live listings are not touched; their photoPlan is NULL and they hold no
-- credits, so an approval of one in review consumes nothing.

-- A new enum value cannot be used in the transaction that adds it, and it is
-- not used here.
ALTER TYPE "MediaOwner" ADD VALUE IF NOT EXISTS 'VEHICLE_SUBMISSION';

CREATE TYPE "PhotoPlan" AS ENUM ('DEALER', 'DEALERS_DRIVE');

CREATE TYPE "VehiclePhotoSlot" AS ENUM (
  'FRONT_THREE_QUARTER', 'FRONT', 'LEFT_SIDE', 'REAR_THREE_QUARTER', 'REAR',
  'RIGHT_SIDE', 'DASHBOARD', 'FRONT_SEATS', 'REAR_SEATS', 'ODOMETER', 'EXTRA'
);

CREATE TYPE "CreditReason" AS ENUM (
  'PURCHASE', 'ADMIN_GRANT', 'ADMIN_DEDUCT', 'HOLD_SUBMIT', 'HOLD_ADJUST', 'RELEASE_REJECT', 'CONSUME_APPROVE'
);

CREATE TYPE "CreditOrderStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

ALTER TABLE "listings"
  ADD COLUMN "photoPlan" "PhotoPlan",
  ADD COLUMN "creditsHeld" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditsSpent" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "listings_credits_check" CHECK ("creditsHeld" >= 0 AND "creditsSpent" >= 0);

ALTER TABLE "dealers"
  ADD CONSTRAINT "dealers_credit_balance_check"
  CHECK ("creditBalance" >= 0 AND "creditsHeld" >= 0 AND "creditsHeld" <= "creditBalance");

CREATE TABLE "vehicle_submission_photos" (
  "id" UUID NOT NULL,
  "vehicleId" UUID NOT NULL,
  "dealerId" UUID NOT NULL,
  "mediaId" UUID NOT NULL,
  "slot" "VehiclePhotoSlot" NOT NULL,
  "uploadedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_submission_photos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vehicle_submission_photos_mediaId_key" ON "vehicle_submission_photos"("mediaId");
CREATE INDEX "vehicle_submission_photos_vehicleId_slot_idx" ON "vehicle_submission_photos"("vehicleId", "slot");
CREATE INDEX "vehicle_submission_photos_dealerId_idx" ON "vehicle_submission_photos"("dealerId");
CREATE UNIQUE INDEX "vehicle_submission_photos_one_per_slot"
  ON "vehicle_submission_photos"("vehicleId", "slot") WHERE "slot" <> 'EXTRA';
ALTER TABLE "vehicle_submission_photos"
  ADD CONSTRAINT "vehicle_submission_photos_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "vehicle_submission_photos_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "vehicle_submission_photos_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "credit_orders" (
  "id" UUID NOT NULL,
  "dealerId" UUID NOT NULL,
  "credits" INTEGER NOT NULL,
  "amountPaise" BIGINT NOT NULL,
  "taxPaise" BIGINT NOT NULL,
  "totalPaise" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "gateway" TEXT NOT NULL,
  "gatewayOrderId" TEXT NOT NULL,
  "gatewayPaymentId" TEXT,
  "status" "CreditOrderStatus" NOT NULL DEFAULT 'CREATED',
  "failureReason" TEXT,
  "createdBy" UUID,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_orders_amounts_check" CHECK (
    "credits" > 0 AND "amountPaise" > 0 AND "taxPaise" >= 0 AND "totalPaise" = "amountPaise" + "taxPaise"
  ),
  CONSTRAINT "credit_orders_paid_check" CHECK (
    ("status" = 'PAID') = ("paidAt" IS NOT NULL AND "gatewayPaymentId" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "credit_orders_gatewayOrderId_key" ON "credit_orders"("gatewayOrderId");
CREATE UNIQUE INDEX "credit_orders_gatewayPaymentId_key" ON "credit_orders"("gatewayPaymentId");
CREATE INDEX "credit_orders_dealerId_createdAt_idx" ON "credit_orders"("dealerId", "createdAt");
CREATE INDEX "credit_orders_status_createdAt_idx" ON "credit_orders"("status", "createdAt");
ALTER TABLE "credit_orders"
  ADD CONSTRAINT "credit_orders_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "credit_transactions" (
  "id" BIGSERIAL NOT NULL,
  "dealerId" UUID NOT NULL,
  "reason" "CreditReason" NOT NULL,
  "delta" INTEGER NOT NULL,
  "heldDelta" INTEGER NOT NULL DEFAULT 0,
  "balanceAfter" INTEGER NOT NULL,
  "heldAfter" INTEGER NOT NULL,
  "listingId" UUID,
  "orderId" UUID,
  "actorType" TEXT NOT NULL,
  "actorId" UUID,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_transactions_balance_check" CHECK (
    "balanceAfter" >= 0 AND "heldAfter" >= 0 AND "heldAfter" <= "balanceAfter"
  ),
  CONSTRAINT "credit_transactions_moves_check" CHECK ("delta" <> 0 OR "heldDelta" <> 0)
);
CREATE INDEX "credit_transactions_dealerId_id_idx" ON "credit_transactions"("dealerId", "id");
CREATE INDEX "credit_transactions_listingId_idx" ON "credit_transactions"("listingId");
CREATE UNIQUE INDEX "credit_transactions_one_purchase_per_order"
  ON "credit_transactions"("orderId") WHERE "reason" = 'PURCHASE';
ALTER TABLE "credit_transactions"
  ADD CONSTRAINT "credit_transactions_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "credit_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "credit_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_webhook_events" (
  "id" TEXT NOT NULL,
  "gateway" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "outcome" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payment_webhook_events_receivedAt_idx" ON "payment_webhook_events"("receivedAt");
