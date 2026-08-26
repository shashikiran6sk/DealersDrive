import { randomUUID } from 'node:crypto';

import { formatLakh, formatRupees, initialsOf, slugify } from '@dealers-drive/contracts';
import { PrismaClient, type CreditReason } from '@prisma/client';

import { env } from '../../src/config/env.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { CONFIG_DEFAULTS } from '../../src/platform/config/platform-config.js';
import { createStorage } from '../../src/platform/storage/factory.js';
import { ensureBucket } from '../../src/platform/storage/s3.adapter.js';
import { createSearchRepository } from '../../src/modules/search/search.repository.js';
import {
  CITIES,
  COLORS,
  CREDIT_PACKS,
  DEALERS,
  ENQUIRIES,
  PHOTO_LABELS,
  RTOS,
  VEHICLES,
  type SeedVehicle,
} from './data.js';
import { assertCatalogueIntegrity, VEHICLE_CATALOGUE } from './catalog/index.js';
import { DERIVATIVE_WIDTHS, generatePlaceholderImage } from './images.js';

/**
 * Development seed.
 *
 * Idempotent by truncation: it clears every application table and rebuilds the
 * world, so `pnpm db:seed` is safe to re-run and always produces the same
 * database. The credit ledger is *built*, not asserted — each dealer's balance
 * is whatever the chain of grants, purchases, holds and consumptions arrives
 * at, because the ledger is the truth and `Dealer.creditBalance` is only its
 * cache (ARCHITECTURE §26.2).
 */

const prisma = new PrismaClient();
// The same driver the API will read them back through — a seed that always
// wrote to local disk would leave a MinIO-backed developer with 100 broken
// images and no clue why.
const storage = createStorage();
const search = createSearchRepository(prisma);

const LISTING_DAYS = 90;
const now = new Date();

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function minutesAgo(minutes: number): Date {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

async function truncate(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      listing_search, audit_logs, outbox_events, platform_config,
      credit_transactions, invoices, payments, orders, credit_packs,
      photo_requests, phone_reveals, enquiries, listing_view_daily, listings,
      vehicle_media, media, vehicles, dealer_documents, dealer_members,
      dealers, sessions, oauth_identities, users, colors, rtos, cities, variants, models, makes
    RESTART IDENTITY CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE enquiry_reference_seq RESTART WITH 10000`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE invoice_number_seq RESTART WITH 1`);
}

async function seedConfig(): Promise<void> {
  for (const entry of CONFIG_DEFAULTS) {
    await prisma.platformConfig.create({
      data: {
        key: entry.key,
        value: entry.value,
        label: entry.label,
        valueType: entry.type,
      },
    });
  }
}

async function seedCatalog() {
  const cities = new Map<string, string>();
  for (const city of CITIES) {
    const row = await prisma.city.create({ data: city });
    cities.set(city.slug, row.id);
  }

  await prisma.rto.createMany({ data: RTOS });

  const colors = new Map<string, string>();
  for (const color of COLORS) {
    const row = await prisma.color.create({ data: color });
    colors.set(color.slug, row.id);
  }

  const makes = new Map<string, string>();
  const models = new Map<string, string>();
  const variants = new Map<string, string>();

  // Before the first INSERT, not after the four-hundredth: a duplicate slug
  // would otherwise surface as a unique-constraint failure halfway through,
  // leaving a half-written catalogue and an error naming the index rather than
  // the offending variant.
  assertCatalogueIntegrity();

  // `createMany` per level rather than a create per row. The catalogue is
  // ~2,400 rows and one round trip each turned the seed into a coffee break;
  // ids are generated here so the maps can be built without reading back.
  for (const make of VEHICLE_CATALOGUE) {
    makes.set(make.slug, randomUUID());
  }
  await prisma.make.createMany({
    data: VEHICLE_CATALOGUE.map((make) => ({
      id: makes.get(make.slug)!,
      slug: make.slug,
      name: make.name,
      popularity: make.popularity,
    })),
  });

  for (const make of VEHICLE_CATALOGUE) {
    for (const model of make.models) {
      models.set(`${make.slug}/${model.slug}`, randomUUID());
      for (const variant of model.variants) {
        variants.set(`${make.slug}/${model.slug}/${variant.slug}`, randomUUID());
      }
    }
  }

  await prisma.model.createMany({
    data: VEHICLE_CATALOGUE.flatMap((make) =>
      make.models.map((model) => ({
        id: models.get(`${make.slug}/${model.slug}`)!,
        makeId: makes.get(make.slug)!,
        slug: model.slug,
        name: model.name,
        bodyType: model.bodyType,
        yearFrom: model.yearFrom,
        yearTo: model.yearTo,
      })),
    ),
  });

  await prisma.variant.createMany({
    data: VEHICLE_CATALOGUE.flatMap((make) =>
      make.models.flatMap((model) =>
        model.variants.map((variant) => ({
          id: variants.get(`${make.slug}/${model.slug}/${variant.slug}`)!,
          modelId: models.get(`${make.slug}/${model.slug}`)!,
          slug: variant.slug,
          name: variant.name,
          fuel: variant.fuel,
          transmission: variant.transmission,
          engineCc: variant.engineCc,
          seats: variant.seats,
        })),
      ),
    ),
  });

  return { cities, colors, makes, models, variants };
}

type Catalog = Awaited<ReturnType<typeof seedCatalog>>;

/**
 * The one admin account, and the only account in the system with a password.
 *
 * `DEV_ADMIN_PASSWORD` is read once, hashed with the same Argon2id parameters
 * sign-in verifies against, and dropped. The plaintext is never written to a
 * row, never logged, and never returned by any endpoint — the value the
 * developer types comes from their own `.env`, not from anything this seed
 * prints. Re-running the seed re-hashes it, so rotating the variable rotates
 * the credential.
 */
async function seedAdmin(): Promise<string> {
  const admin = await prisma.user.create({
    data: {
      fullName: 'Dealers-Drive Operations',
      roleTitle: 'Platform admin',
      email: env.DEV_ADMIN_EMAIL,
      phone: '+919000000001',
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
      isPlatformAdmin: true,
      adminRole: 'SUPER_ADMIN',
      passwordHash: await hashPassword(env.DEV_ADMIN_PASSWORD),
    },
  });
  return admin.id;
}

async function seedDealers() {
  const dealers = new Map<string, { id: string; ownerId: string; slug: string }>();

  for (const seed of DEALERS) {
    const city = await prisma.city.findUnique({ where: { slug: seed.citySlug } });

    const owner = await prisma.user.create({
      data: {
        fullName: seed.ownerName,
        roleTitle: seed.ownerRole,
        email: seed.email,
        phone: seed.phone,
        phoneVerifiedAt: daysAgo(400),
        emailVerifiedAt: seed.status === 'ACTIVE' ? daysAgo(399) : null,
      },
    });

    const dealer = await prisma.dealer.create({
      data: {
        slug: seed.slug,
        brandName: seed.brandName,
        legalName: seed.legalName,
        tagline: seed.tagline,
        about: seed.about,
        gstin: seed.gstin,
        pan: seed.pan,
        status: seed.status,
        cityId: city?.id ?? null,
        addressLine: seed.addressLine,
        pincode: seed.pincode,
        lat: seed.lat,
        lng: seed.lng,
        contactPhone: seed.phone,
        contactEmail: seed.email,
        landline: seed.landline,
        workingHours: { mon_sat: '09:30-20:00', sun: null },
        establishedYear: seed.establishedYear,
        specialities: seed.services,
        medianResponseMins: seed.medianResponseMins,
        approvedAt: seed.status === 'ACTIVE' ? daysAgo(380) : null,
        createdAt: daysAgo(400),
      },
    });

    await prisma.dealerMember.create({
      data: { dealerId: dealer.id, userId: owner.id, role: 'OWNER', permissions: [] },
    });

    // KYC: verified for live dealers, still under review for the applicant.
    for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'] as const) {
      await prisma.dealerDocument.create({
        data: {
          dealerId: dealer.id,
          type,
          fileName:
            type === 'GST_CERTIFICATE'
              ? 'gst-cert.pdf'
              : type === 'PAN_CARD'
                ? 'pan-card.jpg'
                : 'eb-bill.pdf',
          status: seed.status === 'ACTIVE' ? 'VERIFIED' : 'UPLOADED',
          reviewedAt: seed.status === 'ACTIVE' ? daysAgo(381) : null,
          createdAt: daysAgo(390),
        },
      });
    }

    dealers.set(seed.key, { id: dealer.id, ownerId: owner.id, slug: dealer.slug });
  }

  return dealers;
}

type Dealers = Awaited<ReturnType<typeof seedDealers>>;

async function seedPacks() {
  const packs = new Map<string, string>();
  for (const pack of CREDIT_PACKS) {
    const row = await prisma.creditPack.create({
      data: { ...pack, pricePaise: BigInt(pack.pricePaise) },
    });
    packs.set(pack.slug, row.id);
  }
  return packs;
}

interface LedgerEntry {
  id: string;
  dealerId: string;
  delta: number;
  reason: CreditReason;
  label: string;
  listingId?: string;
  orderId?: string;
  actorType: 'DEALER' | 'ADMIN' | 'SYSTEM';
  actorId?: string;
  createdAt: Date;
}

/**
 * The credit ledger, built the way the application builds it — with one extra
 * step the application does not need.
 *
 * The seed writes history out of order: it walks vehicles in array order while
 * their submissions are spread across four months. A ledger's `balanceAfter`
 * chain is only meaningful in append order, so entries are **buffered and
 * flushed in timestamp order**. Ids are generated up front, so a listing can
 * still reference the transaction that paid for it before the flush happens.
 *
 * If the flush ever produced a negative balance it would mean the seeded
 * history is wrong, so it throws rather than clamping.
 */
class Ledger {
  private entries: LedgerEntry[] = [];
  private balances = new Map<string, number>();

  record(input: Omit<LedgerEntry, 'id'>): { id: string } {
    const id = randomUUID();
    this.entries.push({ id, ...input });
    return { id };
  }

  async flush(): Promise<void> {
    const ordered = [...this.entries].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    for (const entry of ordered) {
      const before = this.balances.get(entry.dealerId) ?? 0;
      const balanceAfter = before + entry.delta;
      if (balanceAfter < 0) {
        throw new Error(
          `Seeded history drives ${entry.dealerId} negative at "${entry.label}". Fix the seed, not the check.`,
        );
      }

      await prisma.creditTransaction.create({
        data: {
          id: entry.id,
          dealerId: entry.dealerId,
          delta: entry.delta,
          balanceAfter,
          reason: entry.reason,
          label: entry.label,
          listingId: entry.listingId ?? null,
          orderId: entry.orderId ?? null,
          actorType: entry.actorType,
          actorId: entry.actorId ?? null,
          createdAt: entry.createdAt,
        },
      });

      this.balances.set(entry.dealerId, balanceAfter);
    }

    this.entries = [];
  }

  balanceOf(dealerId: string): number {
    return this.balances.get(dealerId) ?? 0;
  }
}

async function seedPhotos(vehicleId: string, dealerId: string, count: number, title: string) {
  const media: { id: string; position: number }[] = [];

  for (let position = 0; position < count; position += 1) {
    const label = PHOTO_LABELS[position % PHOTO_LABELS.length] ?? 'Vehicle photo';
    const mediaId = randomUUID();
    const image = await generatePlaceholderImage(`${title} — ${label}`);

    const variants: Record<string, string> = {};
    for (const derivative of image.derivatives) {
      const key = `vehicles/${vehicleId}/${mediaId}/${derivative.width}.webp`;
      await storage.put(key, derivative.body, 'image/webp');
      variants[String(derivative.width)] = key;
    }

    const storageKey = variants[String(DERIVATIVE_WIDTHS[DERIVATIVE_WIDTHS.length - 1])];
    if (!storageKey) throw new Error('No derivative was written');

    await prisma.media.create({
      data: {
        id: mediaId,
        dealerId,
        ownerType: 'VEHICLE',
        storageKey,
        mimeType: 'image/webp',
        bytes: image.bytes,
        width: image.width,
        height: image.height,
        blurhash: image.blurhash,
        variants,
        fileName: `${slugify(label)}.webp`,
        status: 'READY',
      },
    });

    await prisma.vehicleMedia.create({ data: { vehicleId, mediaId, position } });
    media.push({ id: mediaId, position });
  }

  return media;
}

function vehicleTitle(seed: SeedVehicle): string {
  const make = VEHICLE_CATALOGUE.find((m) => m.slug === seed.makeSlug);
  const model = make?.models.find((m) => m.slug === seed.modelSlug);
  const variant = model?.variants.find((v) => v.slug === seed.variantSlug);
  return [make?.name, model?.name, variant?.name].filter(Boolean).join(' ');
}

async function seedVehicles(catalog: Catalog, dealers: Dealers, ledger: Ledger, adminId: string) {
  const created: { seed: SeedVehicle; vehicleId: string; listingId: string | null }[] = [];

  // Grants and purchases first, so a hold never precedes the credit it spends.
  for (const dealerSeed of DEALERS) {
    const dealer = dealers.get(dealerSeed.key);
    if (!dealer || dealerSeed.startingCredits === 0) continue;

    ledger.record({
      dealerId: dealer.id,
      delta: 10,
      reason: 'ADMIN_GRANT',
      label: 'Admin grant — onboarding bonus',
      actorType: 'ADMIN',
      actorId: adminId,
      createdAt: daysAgo(120),
    });
  }

  for (const seed of VEHICLES) {
    const dealer = dealers.get(seed.dealerKey);
    if (!dealer) continue;

    const makeId = catalog.makes.get(seed.makeSlug);
    const modelId = catalog.models.get(`${seed.makeSlug}/${seed.modelSlug}`);
    const variantId = catalog.variants.get(
      `${seed.makeSlug}/${seed.modelSlug}/${seed.variantSlug}`,
    );
    const cityId = catalog.cities.get(seed.citySlug);
    const colorId = catalog.colors.get(seed.colorSlug);
    if (!makeId || !modelId || !cityId) continue;

    const title = vehicleTitle(seed);
    const isDraft = seed.state === 'DRAFT';
    const vehicleId = randomUUID();
    const shortId = vehicleId.slice(0, 6);
    const slug = isDraft
      ? null
      : slugify(`${seed.year}-${title}-${seed.citySlug}`) + `-${shortId}`;

    const createdAt = daysAgo((seed.approvedDaysAgo ?? 2) + 4);

    await prisma.vehicle.create({
      data: {
        id: vehicleId,
        dealerId: dealer.id,
        makeId,
        modelId,
        variantId: variantId ?? null,
        year: seed.year,
        pricePaise: isDraft ? null : BigInt(seed.pricePaise),
        kmDriven: isDraft ? null : seed.km,
        fuel: seed.fuel,
        transmission: seed.transmission,
        bodyType: seed.bodyType,
        ownerNumber: isDraft ? null : seed.owners,
        colorId: colorId ?? null,
        seats: seed.seats,
        airbags: seed.airbags,
        rtoCode: seed.rtoCode,
        cityId,
        regNumberMasked: `${seed.rtoCode.replace('-', ' ')}••${String(seed.km).slice(-4)}`,
        insuranceType: 'COMPREHENSIVE',
        insuranceValidTill: new Date(`${seed.year + 6}-03-31T00:00:00.000Z`),
        priceNegotiable: seed.owners === 1 ? 'SLIGHTLY' : 'FIXED',
        description: seed.description || null,
        features: seed.features,
        status: seed.state === 'SOLD' ? 'SOLD' : isDraft ? 'DRAFT' : 'READY',
        slug,
        soldPricePaise: seed.state === 'SOLD' ? BigInt(seed.pricePaise - 1500000) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    // Drafts get two photos so the wizard's "add 4 more" state is reachable.
    const photoCount = isDraft ? 2 : 8;
    const media = await seedPhotos(vehicleId, dealer.id, photoCount, title);
    const primary = media[0];
    if (primary) {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { primaryMediaId: primary.id },
      });
    }

    if (isDraft) {
      created.push({ seed, vehicleId, listingId: null });
      continue;
    }

    const listingId = randomUUID();
    const submittedAt = daysAgo((seed.approvedDaysAgo ?? 0) + 1);
    const approvedAt = seed.approvedDaysAgo === undefined ? null : daysAgo(seed.approvedDaysAgo);

    // HOLD_SUBMIT — the credit is reserved the moment the dealer submits.
    const hold = ledger.record({
      dealerId: dealer.id,
      delta: -1,
      reason: 'HOLD_SUBMIT',
      label: `Submitted for review — ${seed.year} ${title}`,
      listingId,
      actorType: 'DEALER',
      actorId: dealer.ownerId,
      createdAt: submittedAt,
    });

    const status =
      seed.state === 'ACTIVE'
        ? 'APPROVED'
        : seed.state === 'PENDING'
          ? 'PENDING_REVIEW'
          : seed.state === 'REJECTED'
            ? 'REJECTED'
            : seed.state === 'EXPIRED'
              ? 'EXPIRED'
              : seed.state === 'SOLD'
                ? 'SOLD'
                : 'CHANGES_REQUESTED';

    const expiresAt =
      approvedAt && (status === 'APPROVED' || status === 'EXPIRED' || status === 'SOLD')
        ? new Date(approvedAt.getTime() + LISTING_DAYS * 24 * 60 * 60 * 1000)
        : null;

    await prisma.listing.create({
      data: {
        id: listingId,
        vehicleId,
        dealerId: dealer.id,
        status,
        submittedAt,
        reviewedAt: approvedAt ?? (status === 'REJECTED' ? daysAgo(2) : null),
        reviewedBy: status === 'PENDING_REVIEW' ? null : adminId,
        rejectionReason: status === 'REJECTED' ? (seed.reason ?? null) : null,
        approvedAt,
        expiresAt,
        creditHeld: status === 'PENDING_REVIEW' || status === 'CHANGES_REQUESTED',
        creditTxnId: hold.id,
        soldAt: status === 'SOLD' ? daysAgo(3) : null,
        viewCount: seed.views,
        enquiryCount: seed.enquiries,
        revealCount: Math.round(seed.enquiries * 1.4),
      },
    });

    if (status === 'APPROVED' || status === 'EXPIRED' || status === 'SOLD') {
      // CONSUME_APPROVE settles the hold: delta 0, and still a row, because the
      // dealer's mental model is "I published a car and it cost me a credit".
      ledger.record({
        dealerId: dealer.id,
        delta: 0,
        reason: 'CONSUME_APPROVE',
        label: `Listing published — ${seed.year} ${title}`,
        listingId,
        actorType: 'ADMIN',
        actorId: adminId,
        createdAt: approvedAt ?? submittedAt,
      });
    }

    if (status === 'REJECTED') {
      ledger.record({
        dealerId: dealer.id,
        delta: 1,
        reason: 'RELEASE_REJECT',
        label: `Credit returned — ${seed.year} ${title}`,
        listingId,
        actorType: 'ADMIN',
        actorId: adminId,
        createdAt: daysAgo(2),
      });
    }

    created.push({ seed, vehicleId, listingId });
  }

  return created;
}

/** One purchase per live dealer, plus one failed attempt so history shows both. */
async function seedPurchases(dealers: Dealers, packs: Map<string, string>, ledger: Ledger) {
  const purchases: { slug: string; packSlug: string; daysAgo: number; failed?: boolean }[] = [
    { slug: 'sri-lakshmi-motors', packSlug: 'pack-25', daysAgo: 15 },
    { slug: 'sri-lakshmi-motors', packSlug: 'pack-10', daysAgo: 38 },
    { slug: 'sri-lakshmi-motors', packSlug: 'pack-10', daysAgo: 39, failed: true },
    { slug: 'velavan-cars', packSlug: 'pack-50', daysAgo: 22 },
    { slug: 'anbu-auto-hub', packSlug: 'pack-25', daysAgo: 9 },
    { slug: 'mrv-motors', packSlug: 'pack-10', daysAgo: 30 },
  ];

  let invoiceSeq = 300;

  for (const purchase of purchases) {
    const dealer = [...dealers.values()].find((d) => d.slug === purchase.slug);
    const packDef = CREDIT_PACKS.find((p) => p.slug === purchase.packSlug);
    const packId = packs.get(purchase.packSlug);
    if (!dealer || !packDef || !packId) continue;

    const amountPaise = BigInt(packDef.pricePaise);
    const taxPaise = (amountPaise * 18n) / 100n;
    const totalPaise = amountPaise + taxPaise;
    const at = daysAgo(purchase.daysAgo);
    invoiceSeq += 1;
    const number = `DD-INV-${at.getUTCFullYear()}-${String(invoiceSeq).padStart(4, '0')}`;

    const order = await prisma.order.create({
      data: {
        dealerId: dealer.id,
        packId,
        credits: packDef.credits,
        amountPaise,
        taxPaise,
        totalPaise,
        status: purchase.failed ? 'FAILED' : 'PAID',
        gateway: 'development',
        gatewayOrderId: `dev_order_seed_${invoiceSeq}`,
        createdAt: at,
        paidAt: purchase.failed ? null : at,
      },
    });

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        dealerId: dealer.id,
        gatewayPaymentId: `dev_pay_seed_${invoiceSeq}`,
        method: 'development',
        amountPaise: totalPaise,
        status: purchase.failed ? 'FAILED' : 'CAPTURED',
        failureReason: purchase.failed ? 'Payment declined by the issuing bank.' : null,
        rawPayload: { provider: 'development', seeded: true },
        capturedAt: purchase.failed ? null : at,
        createdAt: at,
      },
    });

    await prisma.invoice.create({
      data: {
        number,
        dealerId: dealer.id,
        orderId: order.id,
        paymentId: payment.id,
        credits: purchase.failed ? 0 : packDef.credits,
        amountPaise,
        taxPaise,
        totalPaise,
        status: purchase.failed ? 'FAILED' : 'CAPTURED',
        failureReason: purchase.failed ? 'Payment declined by the issuing bank.' : null,
        gstin: DEALERS.find((d) => d.slug === purchase.slug)?.gstin ?? null,
        placeOfSupply: '33',
        pdfMediaKey: purchase.failed ? null : `invoices/${number}.pdf`,
        issuedAt: at,
      },
    });

    // A failed payment gets an Invoice row and no ledger row (§6, §26.5).
    if (!purchase.failed) {
      ledger.record({
        dealerId: dealer.id,
        delta: packDef.credits,
        reason: 'PURCHASE',
        label: `Purchased — ${packDef.credits} credit pack`,
        orderId: order.id,
        actorType: 'DEALER',
        actorId: dealer.ownerId,
        createdAt: at,
      });
    }
  }
}

async function seedEnquiries(
  dealers: Dealers,
  vehicles: { seed: SeedVehicle; vehicleId: string; listingId: string | null }[],
) {
  const byRef = new Map(vehicles.map((v) => [v.seed.ref, v]));

  for (const enquiry of ENQUIRIES) {
    const dealer = dealers.get(enquiry.dealerKey);
    if (!dealer) continue;
    const vehicle = enquiry.vehicleRef ? byRef.get(enquiry.vehicleRef) : undefined;

    const rows = await prisma.$queryRaw<{ reference: string }[]>`
      SELECT 'DD-EN-' || nextval('enquiry_reference_seq')::text AS reference`;
    const reference = rows[0]?.reference;
    if (!reference) throw new Error('enquiry_reference_seq returned no row');

    const createdAt = minutesAgo(enquiry.minutesAgo);

    await prisma.enquiry.create({
      data: {
        reference,
        dealerId: dealer.id,
        vehicleId: vehicle?.vehicleId ?? null,
        listingId: vehicle?.listingId ?? null,
        name: enquiry.name,
        phone: enquiry.phone,
        email: enquiry.email,
        message: enquiry.message,
        source: enquiry.source,
        status: enquiry.status,
        contactedAt:
          enquiry.status === 'CONTACTED' || enquiry.status === 'CLOSED'
            ? new Date(createdAt.getTime() + 40 * 60 * 1000)
            : null,
        closedAt: enquiry.status === 'CLOSED' ? new Date(createdAt.getTime() + 86_400_000) : null,
        closeReason: enquiry.status === 'CLOSED' ? 'SOLD' : null,
        markedSpamAt: enquiry.status === 'SPAM' ? createdAt : null,
        ip: '127.0.0.1',
        createdAt,
      },
    });
  }
}

/**
 * Seven days of per-listing rollups. The dashboard chart draws Mon–Sun from
 * this table; a single cumulative counter could not produce it (§6).
 */
async function seedViewRollups(
  dealers: Dealers,
  vehicles: { seed: SeedVehicle; vehicleId: string; listingId: string | null }[],
) {
  const shape = [0.46, 0.62, 0.58, 0.81, 1.0, 0.92, 0.54];

  for (const entry of vehicles) {
    if (!entry.listingId || entry.seed.views === 0) continue;
    const dealer = dealers.get(entry.seed.dealerKey);
    if (!dealer) continue;

    // Roughly a third of lifetime views land in the visible week.
    const weekly = Math.max(7, Math.round(entry.seed.views / 3));

    for (let index = 0; index < 7; index += 1) {
      const day = daysAgo(6 - index);
      day.setUTCHours(0, 0, 0, 0);
      const weight = shape[index] ?? 0.5;
      const views = Math.max(1, Math.round((weekly * weight) / 5));

      await prisma.listingViewDaily.create({
        data: {
          listingId: entry.listingId,
          dealerId: dealer.id,
          day,
          views,
          reveals: Math.round(views * 0.06),
          enquiries: index === 4 ? 1 : 0,
        },
      });
    }
  }
}

async function reconcile(dealers: Dealers, ledger: Ledger): Promise<void> {
  for (const dealer of dealers.values()) {
    const held = await prisma.listing.count({
      where: {
        dealerId: dealer.id,
        creditHeld: true,
        status: { in: ['PENDING_REVIEW', 'CHANGES_REQUESTED'] },
      },
    });
    const active = await prisma.listing.count({
      where: { dealerId: dealer.id, status: 'APPROVED' },
    });

    await prisma.dealer.update({
      where: { id: dealer.id },
      data: {
        creditBalance: ledger.balanceOf(dealer.id),
        creditsHeld: held,
        activeListings: active,
      },
    });
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  process.stdout.write('Seeding Dealers-Drive…\n');

  // A fresh MinIO volume has no bucket; the seed is usually the first thing to
  // write to it, and a missing bucket here would surface as 100 failed uploads.
  if (env.STORAGE_DRIVER !== 'local') await ensureBucket();

  await truncate();
  await seedConfig();
  const catalog = await seedCatalog();
  const adminId = await seedAdmin();
  const dealers = await seedDealers();
  const packs = await seedPacks();

  const ledger = new Ledger();
  const vehicles = await seedVehicles(catalog, dealers, ledger, adminId);
  await seedPurchases(dealers, packs, ledger);
  // Written in timestamp order, so `balanceAfter` chains correctly.
  await ledger.flush();
  await seedEnquiries(dealers, vehicles);
  await seedViewRollups(dealers, vehicles);
  await reconcile(dealers, ledger);

  // Only APPROVED listings from ACTIVE dealers enter the catalogue. The seed
  // calls the same indexer the approval subscriber does, so there is exactly
  // one implementation of that rule.
  let indexed = 0;
  for (const entry of vehicles) {
    if (entry.listingId && (await search.index(entry.listingId))) indexed += 1;
  }

  const live = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count FROM listing_search`;

  process.stdout.write(
    [
      `  dealers        ${dealers.size}`,
      `  vehicles       ${vehicles.length}`,
      `  live listings  ${Number(live[0]?.count ?? 0n)} (indexed ${indexed})`,
      `  packs          ${packs.size} · ${CREDIT_PACKS.map((p) => formatRupees(p.pricePaise)).join(' / ')}`,
      `  cheapest live  ${formatLakh(Math.min(...VEHICLES.map((v) => v.pricePaise)))}`,
      `  dev dealer     ${initialsOf('Sri Lakshmi Motors')} · sri-lakshmi-motors · ${ledger.balanceOf(
        [...dealers.values()].find((d) => d.slug === 'sri-lakshmi-motors')?.id ?? '',
      )} credits`,
      `  done in ${((Date.now() - started) / 1000).toFixed(1)}s`,
      '',
    ].join('\n'),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
