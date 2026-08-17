-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPPORT', 'MODERATOR', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "DealerStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DealerRole" AS ENUM ('OWNER', 'MANAGER', 'SALES');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'REMOVED');

-- CreateEnum
CREATE TYPE "DealerDocType" AS ENUM ('GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('REQUIRED', 'UPLOADING', 'UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', 'LPG');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('HATCHBACK', 'SEDAN', 'SUV', 'MUV', 'LUXURY');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('COMPREHENSIVE', 'THIRD_PARTY', 'NONE');

-- CreateEnum
CREATE TYPE "PriceNegotiability" AS ENUM ('SLIGHTLY', 'FIXED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('DRAFT', 'READY', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'SOLD', 'REMOVED');

-- CreateEnum
CREATE TYPE "MediaOwner" AS ENUM ('VEHICLE', 'DEALER_LOGO', 'DEALER_COVER', 'DEALER_DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'ORPHAN');

-- CreateEnum
CREATE TYPE "EnquirySource" AS ENUM ('LISTING_PAGE', 'CALL_BUTTON', 'DEALER_PAGE');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "PhotoRequestStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('PURCHASE', 'ADMIN_GRANT', 'HOLD_SUBMIT', 'RELEASE_REJECT', 'RELEASE_EXPIRED_UNREVIEWED', 'CONSUME_APPROVE', 'ADMIN_ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('CAPTURED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "fullName" TEXT,
    "roleTitle" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "adminRole" "AdminRole",
    "totpSecret" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealers" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "about" TEXT,
    "tagline" TEXT,
    "logoMediaId" UUID,
    "coverMediaId" UUID,
    "status" "DealerStatus" NOT NULL DEFAULT 'DRAFT',
    "cityId" UUID,
    "addressLine" TEXT,
    "pincode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "landline" TEXT,
    "workingHours" JSONB,
    "establishedYear" INTEGER,
    "specialities" TEXT[],
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "creditsHeld" INTEGER NOT NULL DEFAULT 0,
    "activeListings" INTEGER NOT NULL DEFAULT 0,
    "medianResponseMins" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_documents" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "type" "DealerDocType" NOT NULL,
    "mediaId" UUID,
    "fileName" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'REQUIRED',
    "rejectionReason" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_members" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "DealerRole" NOT NULL,
    "permissions" TEXT[],
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "dealer_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "makes" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "popularity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "makes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models" (
    "id" UUID NOT NULL,
    "makeId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyType" "BodyType" NOT NULL,
    "yearFrom" INTEGER NOT NULL,
    "yearTo" INTEGER,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fuel" "FuelType" NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "engineCc" INTEGER,
    "seats" INTEGER,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtos" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "rtos_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "makeId" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "variantId" UUID,
    "year" INTEGER NOT NULL,
    "pricePaise" BIGINT,
    "kmDriven" INTEGER,
    "fuel" "FuelType" NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "bodyType" "BodyType" NOT NULL,
    "ownerNumber" INTEGER,
    "colorId" UUID,
    "seats" INTEGER,
    "airbags" INTEGER,
    "rtoCode" TEXT,
    "cityId" UUID,
    "regNumberMasked" TEXT,
    "insuranceType" "InsuranceType",
    "insuranceValidTill" TIMESTAMP(3),
    "priceNegotiable" "PriceNegotiability" NOT NULL DEFAULT 'SLIGHTLY',
    "description" TEXT,
    "features" TEXT[],
    "specs" JSONB NOT NULL DEFAULT '{}',
    "status" "VehicleStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryMediaId" UUID,
    "slug" TEXT,
    "soldPricePaise" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_media" (
    "vehicleId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "vehicle_media_pkey" PRIMARY KEY ("vehicleId","mediaId")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "dealerId" UUID,
    "ownerType" "MediaOwner" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" TEXT,
    "variants" JSONB NOT NULL DEFAULT '{}',
    "fileName" TEXT,
    "warnings" TEXT[],
    "uploadedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" UUID,
    "rejectionReason" TEXT,
    "changeRequestNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "expiryWarned7d" BOOLEAN NOT NULL DEFAULT false,
    "expiryWarned1d" BOOLEAN NOT NULL DEFAULT false,
    "creditHeld" BOOLEAN NOT NULL DEFAULT false,
    "creditTxnId" UUID,
    "renewedFromId" UUID,
    "soldAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "enquiryCount" INTEGER NOT NULL DEFAULT 0,
    "revealCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_view_daily" (
    "listingId" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "reveals" INTEGER NOT NULL DEFAULT 0,
    "enquiries" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "listing_view_daily_pkey" PRIMARY KEY ("listingId","day")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "vehicleId" UUID,
    "listingId" UUID,
    "dealerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "source" "EnquirySource" NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "contactedAt" TIMESTAMP(3),
    "contactedBy" UUID,
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "note" TEXT,
    "markedSpamAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_reveals" (
    "id" BIGSERIAL NOT NULL,
    "vehicleId" UUID,
    "dealerId" UUID NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_reveals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_requests" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "vehicleId" UUID,
    "vehicleCount" INTEGER NOT NULL DEFAULT 1,
    "status" "PhotoRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "address" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "notes" TEXT,
    "adminNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_packs" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "pricePaise" BIGINT NOT NULL,
    "badge" TEXT,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "label" TEXT NOT NULL,
    "listingId" UUID,
    "orderId" UUID,
    "reversalOfId" UUID,
    "actorType" TEXT NOT NULL,
    "actorId" UUID,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "packId" UUID NOT NULL,
    "credits" INTEGER NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "taxPaise" BIGINT NOT NULL,
    "totalPaise" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "gateway" TEXT NOT NULL DEFAULT 'development',
    "gatewayOrderId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "dealerId" UUID NOT NULL,
    "gatewayPaymentId" TEXT NOT NULL,
    "method" TEXT,
    "amountPaise" BIGINT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "failureReason" TEXT,
    "gatewaySignature" TEXT,
    "rawPayload" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "dealerId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentId" UUID,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "amountPaise" BIGINT NOT NULL,
    "taxPaise" BIGINT NOT NULL,
    "totalPaise" BIGINT NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "failureReason" TEXT,
    "gstin" TEXT,
    "placeOfSupply" TEXT,
    "pdfMediaKey" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "gateway" TEXT NOT NULL,
    "gatewayEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" UUID,
    "dealerId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" BIGSERIAL NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "label" TEXT,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "updatedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "dealers_slug_key" ON "dealers"("slug");

-- CreateIndex
CREATE INDEX "dealers_status_cityId_idx" ON "dealers"("status", "cityId");

-- CreateIndex
CREATE INDEX "dealer_documents_status_createdAt_idx" ON "dealer_documents"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_documents_dealerId_type_key" ON "dealer_documents"("dealerId", "type");

-- CreateIndex
CREATE INDEX "dealer_members_userId_idx" ON "dealer_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_members_dealerId_userId_key" ON "dealer_members"("dealerId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "makes_slug_key" ON "makes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "models_makeId_slug_key" ON "models"("makeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "variants_modelId_slug_key" ON "variants"("modelId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "rtos_state_idx" ON "rtos"("state");

-- CreateIndex
CREATE UNIQUE INDEX "colors_slug_key" ON "colors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_slug_key" ON "vehicles"("slug");

-- CreateIndex
CREATE INDEX "vehicles_dealerId_status_createdAt_idx" ON "vehicles"("dealerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "vehicles_modelId_year_idx" ON "vehicles"("modelId", "year");

-- CreateIndex
CREATE INDEX "vehicles_cityId_pricePaise_idx" ON "vehicles"("cityId", "pricePaise");

-- CreateIndex
CREATE INDEX "vehicle_media_vehicleId_position_idx" ON "vehicle_media"("vehicleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "media_storageKey_key" ON "media"("storageKey");

-- CreateIndex
CREATE INDEX "media_status_createdAt_idx" ON "media"("status", "createdAt");

-- CreateIndex
CREATE INDEX "listings_status_submittedAt_idx" ON "listings"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "listings_dealerId_status_idx" ON "listings"("dealerId", "status");

-- CreateIndex
CREATE INDEX "listings_status_expiresAt_idx" ON "listings"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "listing_view_daily_dealerId_day_idx" ON "listing_view_daily"("dealerId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "enquiries_reference_key" ON "enquiries"("reference");

-- CreateIndex
CREATE INDEX "enquiries_dealerId_status_createdAt_idx" ON "enquiries"("dealerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "enquiries_dealerId_createdAt_idx" ON "enquiries"("dealerId", "createdAt");

-- CreateIndex
CREATE INDEX "enquiries_vehicleId_idx" ON "enquiries"("vehicleId");

-- CreateIndex
CREATE INDEX "enquiries_phone_vehicleId_createdAt_idx" ON "enquiries"("phone", "vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "phone_reveals_dealerId_createdAt_idx" ON "phone_reveals"("dealerId", "createdAt");

-- CreateIndex
CREATE INDEX "phone_reveals_ip_createdAt_idx" ON "phone_reveals"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "photo_requests_status_createdAt_idx" ON "photo_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "photo_requests_dealerId_createdAt_idx" ON "photo_requests"("dealerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "credit_packs_slug_key" ON "credit_packs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_idempotencyKey_key" ON "credit_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "credit_transactions_dealerId_createdAt_idx" ON "credit_transactions"("dealerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "credit_transactions_listingId_idx" ON "credit_transactions"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_gatewayOrderId_key" ON "orders"("gatewayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_dealerId_createdAt_idx" ON "orders"("dealerId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayPaymentId_key" ON "payments"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX "payments_dealerId_createdAt_idx" ON "payments"("dealerId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_status_capturedAt_idx" ON "payments"("status", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_dealerId_issuedAt_idx" ON "invoices"("dealerId", "issuedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_gatewayEventId_key" ON "webhook_events"("gatewayEventId");

-- CreateIndex
CREATE INDEX "webhook_events_processedAt_createdAt_idx" ON "webhook_events"("processedAt", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_dealerId_createdAt_idx" ON "audit_logs"("dealerId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_publishedAt_id_idx" ON "outbox_events"("publishedAt", "id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_documents" ADD CONSTRAINT "dealer_documents_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_members" ADD CONSTRAINT "dealer_members_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_members" ADD CONSTRAINT "dealer_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "makes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_media" ADD CONSTRAINT "vehicle_media_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_media" ADD CONSTRAINT "vehicle_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_view_daily" ADD CONSTRAINT "listing_view_daily_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_view_daily" ADD CONSTRAINT "listing_view_daily_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_reveals" ADD CONSTRAINT "phone_reveals_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_requests" ADD CONSTRAINT "photo_requests_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_packId_fkey" FOREIGN KEY ("packId") REFERENCES "credit_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
