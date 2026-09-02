import {
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_TONES,
  formatDate,
  formatKm,
  formatLakh,
  BODY_TYPE_LABELS,
  formatRupees,
  FUEL_LABELS,
  slugify,
  VEHICLE_WIZARD_STEPS,
  timeAgo,
  type CreateVehicleInput,
  type DealerVehicleDto,
  type DisplayStatus,
  type InventoryQuery,
  type InventoryResponse,
  type InventoryRow,
  type MarkSoldInput,
  type MarkSoldResponse,
  type RemoveListingResponse,
  type RenewListingResponse,
  type SubmitListingResponse,
  type UpdateVehicleInput,
  type VehicleCompleteness,
  type VehicleMediaDto,
  type VehicleStepCompleteness,
  type RcLookupInput,
  type RcLookupResponse,
  type VehicleReportDto,
} from '@dealers-drive/contracts';
import { Prisma, type Listing, type PrismaClient, type VehicleReport } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import { logger } from '../../platform/telemetry/logger.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import { withTenant } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UpstreamUnavailableError,
} from '../../platform/errors.js';
import {
  currentBalance,
  InsufficientCreditsError,
  moveCredits,
  refreshActiveListings,
  refreshHeldCount,
} from '../billing/billing.facade.js';
import type { CatalogRepository } from '../catalog/catalog.facade.js';
import type { DealersRepository } from '../dealers/dealers.facade.js';
import type { ReportsService } from '../reports/reports.facade.js';
import { displayStatus, transition } from '../listings/listings.facade.js';
import { toMediaStatus } from '../media/media.facade.js';
import { decodeCursor, encodeCursor } from '../../platform/pagination.js';
import { mediaUrl } from '../../platform/media/urls.js';
import { plateHash } from '../../platform/rc/plate-hash.js';
import {
  rankVariants,
  resolveColourFamily,
  resolveFuel,
  resolveMake,
  resolveModel,
  resolveYear,
  rtoCodeFromPlate,
} from '../../platform/rc/rc-match.js';
import {
  RcLookupError,
  type RcLookupPort,
  type RcRecords,
  type RcSpecs,
} from '../../platform/rc/rc.port.js';
import type { VehiclesRepository, VehicleWithRelations } from './vehicles.repository.js';

export interface VehiclesDeps {
  prisma: PrismaClient;
  repo: VehiclesRepository;
  dealers: DealersRepository;
  config: PlatformConfigService;
  /** The registration lookup. Mock outside production — see `rc/factory.ts`. */
  rc: RcLookupPort;
  reports: ReportsService;
  /** Read-only here: the taxonomy an RC string is resolved against. */
  catalog: CatalogRepository;
}

function toDateOrNull(iso: string | null): Date | null {
  if (!iso) return null;
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function createVehiclesService({
  prisma,
  repo,
  dealers,
  config,
  rc,
  reports,
  catalog,
}: VehiclesDeps) {
  /** The live listing, if any — the newest that is not a dead end. */
  function liveListing(vehicle: VehicleWithRelations): Listing | null {
    return vehicle.listings[0] ?? null;
  }

  /**
   * Validates catalogue references before they reach Prisma.
   *
   * Without this, an id that is a well-formed uuid but names nothing becomes a
   * foreign-key violation, which surfaces as an unhandled Prisma error and a
   * **500** — a client mistake reported as a server fault, and in development
   * with the query text attached. The schema cannot catch it: `Uuid` says the
   * shape is right, not that the row exists.
   *
   * 404 rather than 422, because that is what the rest of the API answers for an
   * id that names nothing, and `field` says which one.
   */
  async function assertCatalogue(refs: {
    makeId?: string | undefined;
    modelId?: string | undefined;
    variantId?: string | null | undefined;
    colorId?: string | null | undefined;
    cityId?: string | undefined;
  }): Promise<void> {
    const broken = await repo.findBrokenCatalogueRef(refs);
    if (!broken) return;

    throw new NotFoundError(
      `That ${FIELD_LABELS[broken] ?? broken} is not in the catalogue. Pick one from GET /v1/catalog/bundle.`,
      {
        errors: [
          { field: broken, code: 'NOT_IN_CATALOGUE', message: 'Not a known catalogue entry.' },
        ],
      },
    );
  }

  /**
   * Which of the wizard's required fields this vehicle still lacks, per step.
   *
   * The field list is `VEHICLE_WIZARD_STEPS` in `packages/contracts` — the same
   * array the web wizard renders — so "required" has exactly one definition and
   * the browser cannot hold a more permissive copy of it. This function is what
   * makes the requirement un-bypassable: the wizard reads `steps[].complete` to
   * decide whether `Continue` is enabled, and `submit()` below refuses outright
   * when anything is missing, so skipping the UI by PATCHing the API directly
   * buys a dealer a draft they cannot publish rather than a shortcut.
   */
  async function completeness(
    vehicle: VehicleWithRelations,
    report?: VehicleReport | null,
  ): Promise<VehicleCompleteness> {
    const minPhotos = await config.number('listing.minPhotos');
    const readyPhotos = vehicle.media.filter((entry) => entry.media.status === 'READY').length;

    const filled: Record<string, boolean> = {
      makeId: Boolean(vehicle.makeId),
      modelId: Boolean(vehicle.modelId),
      variantId: vehicle.variantId !== null,
      year: Boolean(vehicle.year),
      fuel: Boolean(vehicle.fuel),
      transmission: Boolean(vehicle.transmission),
      bodyType: Boolean(vehicle.bodyType),
      kmDriven: vehicle.kmDriven !== null,
      ownerNumber: vehicle.ownerNumber !== null,
      colorId: vehicle.colorId !== null,
      rtoCode: (vehicle.rtoCode?.trim().length ?? 0) > 0,
      insuranceType: vehicle.insuranceType !== null,
      insuranceValidTill: vehicle.insuranceValidTill !== null,
      cityId: vehicle.cityId !== null,
      regNumberMasked: (vehicle.regNumberMasked?.trim().length ?? 0) > 0,
      photos: readyPhotos >= minPhotos,
      pricePaise: vehicle.pricePaise !== null,
      description: (vehicle.description?.trim().length ?? 0) >= 100,
    };

    const steps: VehicleStepCompleteness[] = VEHICLE_WIZARD_STEPS.map((step, index) => {
      const missing = step.fields.filter((field) => !filled[field]);
      return {
        key: step.key,
        label: step.label,
        index,
        complete: missing.length === 0,
        missing: [...missing],
      };
    });

    const missing = steps.flatMap((step) => step.missing);
    const total = Object.keys(filled).length;
    const percent = Math.round(((total - missing.length) / total) * 100);

    const blockers: VehicleCompleteness['blockers'] = [];

    /**
     * A vehicle the government has flagged does not go on the marketplace.
     *
     * This rides the existing blockers array rather than inventing a second
     * enforcement path, which buys three properties for free: the wizard
     * already renders blockers, `canSubmit` already goes false, and `submit()`
     * below already refuses independently of the UI.
     *
     * The message says "contact us", not "rejected", on purpose. Blacklist
     * flags carry real false positives — stale tax defaults, cleared theft
     * reports an RTO never updated, NOCs for transfers that completed — and an
     * automatic permanent rejection would strand honest dealers with no
     * recourse. An admin can override it, and the override is audit-logged.
     *
     * `UNKNOWN` is deliberately not blocked. We could not read the records;
     * that is our problem, not grounds to stop someone selling their car.
     */
    if (report?.blacklistStatus === 'BLACKLISTED') {
      blockers.push({
        code: 'VEHICLE_BLACKLISTED',
        message:
          'Government records flag this vehicle. Contact us before listing it — ' +
          'we can help if the record is out of date.',
      });
    }

    if (readyPhotos < minPhotos) {
      blockers.push({
        code: 'TOO_FEW_PHOTOS',
        message: `Add ${minPhotos - readyPhotos} more photo${
          minPhotos - readyPhotos === 1 ? '' : 's'
        } (${minPhotos} required).`,
      });
    }
    for (const field of missing) {
      if (field === 'photos') continue;
      blockers.push({
        code: 'VEHICLE_INCOMPLETE',
        message: `${FIELD_LABELS[field] ?? field} is still missing.`,
      });
    }

    return { percent, missing, canSubmit: blockers.length === 0, blockers, steps };
  }

  async function toDto(vehicle: VehicleWithRelations): Promise<DealerVehicleDto> {
    const listing = liveListing(vehicle);
    const status = displayStatus(vehicle, listing);
    const balance = (await dealers.findById(vehicle.dealerId))?.creditBalance ?? 0;
    // Read once and reused for both `completeness` (which needs the blacklist
    // status) and the DTO, rather than fetched twice on every vehicle read.
    const report = await reports.latest(vehicle.id);
    const title = [vehicle.year, vehicle.make.name, vehicle.model.name, vehicle.variant?.name]
      .filter(Boolean)
      .join(' ');

    return {
      id: vehicle.id,
      status: vehicle.status,
      displayStatus: status,
      statusLabel: DISPLAY_STATUS_LABELS[status],
      statusTone: DISPLAY_STATUS_TONES[status],
      slug: vehicle.slug,
      title,
      makeId: vehicle.makeId,
      modelId: vehicle.modelId,
      variantId: vehicle.variantId,
      makeName: vehicle.make.name,
      modelName: vehicle.model.name,
      variantName: vehicle.variant?.name ?? null,
      year: vehicle.year,
      fuel: vehicle.fuel,
      transmission: vehicle.transmission,
      bodyType: vehicle.bodyType,
      kmDriven: vehicle.kmDriven,
      ownerNumber: vehicle.ownerNumber,
      colorId: vehicle.colorId,
      seats: vehicle.seats,
      airbags: vehicle.airbags,
      rtoCode: vehicle.rtoCode,
      cityId: vehicle.cityId,
      regNumberMasked: vehicle.regNumberMasked,
      insuranceType: vehicle.insuranceType,
      insuranceValidTill: vehicle.insuranceValidTill?.toISOString() ?? null,
      priceNegotiable: vehicle.priceNegotiable,
      pricePaise: vehicle.pricePaise === null ? null : Number(vehicle.pricePaise),
      priceLabel: vehicle.pricePaise === null ? '—' : formatLakh(vehicle.pricePaise),
      description: vehicle.description,
      features: vehicle.features,
      photoCount: vehicle.media.filter((entry) => entry.media.status === 'READY').length,
      media: vehicle.media.map(toMediaDto(vehicle.primaryMediaId)),
      completeness: await completeness(vehicle, report),
      creditPreview: { balance, cost: 1, balanceAfterPublish: Math.max(0, balance - 1) },
      rejectionReason: listing?.rejectionReason ?? null,
      changeRequestNote: listing?.changeRequestNote ?? null,
      rcVerifiedAt: vehicle.rcVerifiedAt?.toISOString() ?? null,
      normsType: vehicle.normsType,
      report:
        report && (await config.boolean('feature.vehicleReport'))
          ? await reports.toDealerDto(report)
          : null,
    };
  }

  // ─────────── RC lookup helpers ─────────────────────────────────────────

  function notFoundForPlate(): NotFoundError {
    return new NotFoundError(
      'We could not find a registration certificate for that number. ' +
        'It may be very new, or recently transferred.',
      { errors: [{ field: 'regNumber', code: 'RC_NOT_FOUND', message: 'No RC on record.' }] },
    );
  }

  /**
   * Provider failure → what the dealer is told.
   *
   * The distinction that matters: our exhausted credits and our un-whitelisted
   * IP are **our** problems. They must never read as "there is something wrong
   * with your vehicle" — the dealer sees generic unavailability and falls back
   * to the manual form, while the operator gets paged by the adapter's log
   * line. A dealer should never be able to tell our billing problem from a
   * government server being slow.
   */
  function translateRcFailure(error: unknown): Error {
    if (!(error instanceof RcLookupError)) {
      return error instanceof Error ? error : new Error('Vehicle records lookup failed.');
    }
    if (error.kind === 'NOT_FOUND') return notFoundForPlate();
    return new UpstreamUnavailableError(
      error.kind === 'RATE_LIMITED'
        ? 'The vehicle records service is busy. Try again shortly, or enter the details by hand.'
        : 'Vehicle records are not responding right now. You can enter the details by hand.',
      { code: 'RC_UNAVAILABLE' },
    );
  }

  /** Remembers a miss briefly, so retyping a wrong plate does not re-bill us. */
  async function cacheMiss(regHash: string): Promise<void> {
    const minutes = await config.number('rcLookup.missCacheMinutes');
    await repo.saveRcLookup({
      regHash,
      provider: rc.provider,
      specs: {},
      resolved: {},
      records: Prisma.JsonNull,
      expiresAt: new Date(Date.now() + minutes * 60 * 1000),
      found: false,
    });
  }

  /** Runs the pure resolver over the live catalogue. */
  async function resolveBasics(specs: RcSpecs): Promise<RcLookupResponse['basics']> {
    const makes = await catalog.taxonomyForMatching();
    const make = resolveMake(specs, makes);
    const year = resolveYear(specs);

    const models = make.value ? (makes.find((row) => row.id === make.value)?.models ?? []) : [];
    const model = resolveModel(specs.makerModel, models, year.value);

    const variants = model.value ? await catalog.variantRowsForModel(model.value) : [];
    const variant = rankVariants(specs, model.name, variants);

    const bodyType = model.value
      ? (models.find((row) => row.id === model.value)?.bodyType ?? null)
      : null;

    const fuel = resolveFuel(specs);

    return {
      makeId: make,
      modelId: model,
      variantId: variant,
      year,
      fuel: fuel
        ? { value: fuel, name: FUEL_LABELS[fuel], confidence: 'EXACT', candidates: [] }
        : { value: null, name: null, confidence: 'NONE', candidates: [] },
      /**
       * An RC does not record the gearbox. Not "we could not read it" — the
       * field does not exist on the certificate, which is the single biggest
       * reason the confirm step survives this feature.
       */
      transmission: { value: null, name: null, confidence: 'NONE', candidates: [] },
      bodyType: bodyType
        ? // Taken from our own model row, not the RC's body code — those are
          // commercial-vehicle shaped and describe a Swift as a "SALOON".
          {
            value: bodyType,
            name: BODY_TYPE_LABELS[bodyType],
            confidence: 'LIKELY',
            candidates: [],
          }
        : { value: null, name: null, confidence: 'NONE', candidates: [] },
    };
  }

  async function resolveDetails(
    specs: RcSpecs,
    registrationNumber: string,
  ): Promise<RcLookupResponse['details']> {
    const family = resolveColourFamily(specs);
    const colour = family ? await catalog.colorByFamily(family) : null;

    // From the plate, not from the provider's RTO name: "VELLORE",
    // "VELLORE RTO" and "RTO VELLORE" are one office spelled three ways.
    const rtoCode = rtoCodeFromPlate(registrationNumber);
    const rto = rtoCode ? await catalog.rtoByCode(rtoCode) : null;

    return {
      ownerNumber: specs.ownerNumber,
      colorId: colour?.id ?? null,
      colorName: colour?.name ?? null,
      seats: specs.seatingCapacity,
      // Only if we actually carry that RTO. A code we cannot resolve would
      // fail the catalogue check at PATCH time and read as our bug.
      rtoCode: rto?.code ?? null,
      insuranceValidTill: null,
      normsType: specs.normsType,
    };
  }

  /** The columns `create` writes from a confirmed snapshot. */
  async function detailColumnsFrom(
    specs: RcSpecs,
    registrationNumber: string | undefined,
  ): Promise<Record<string, unknown>> {
    const details = await resolveDetails(specs, registrationNumber ?? '');
    return {
      ...(details.ownerNumber !== null ? { ownerNumber: details.ownerNumber } : {}),
      ...(details.colorId ? { colorId: details.colorId } : {}),
      ...(details.seats !== null ? { seats: details.seats } : {}),
      ...(details.rtoCode ? { rtoCode: details.rtoCode } : {}),
      ...(details.normsType ? { normsType: details.normsType } : {}),
    };
  }

  /**
   * The cached lookup behind an `rcLookupId`, if it is genuinely this plate's.
   *
   * Returns null rather than throwing when the id does not match the
   * registration being created. A mismatch is either a stale browser tab or
   * someone trying to attach one car's records to another; neither deserves an
   * error page, and both deserve to be ignored. The draft is still created —
   * just without RC provenance, exactly as a hand-typed one would be.
   */
  async function loadSnapshot(
    lookupId: string,
    registrationNumber: string | null,
  ): Promise<{ specs: RcSpecs; records: RcRecords | null } | null> {
    if (!registrationNumber) return null;
    const row = await repo.findRcLookupById(lookupId);
    if (!row || !row.found) return null;
    if (row.regHash !== plateHash(registrationNumber)) return null;

    const freshnessHours = await config.number('report.freshnessHours');
    const recordsFresh = Date.now() - row.fetchedAt.getTime() < freshnessHours * 60 * 60 * 1000;

    return {
      specs: row.specs as unknown as RcSpecs,
      records: recordsFresh ? ((row.records as unknown as RcRecords | null) ?? null) : null,
    };
  }

  /**
   * A report shaped for display before any vehicle exists.
   *
   * The lookup screen shows challans and blacklist status while the dealer is
   * still deciding whether to add the car — which is exactly when that
   * information is most useful. Nothing is persisted; the ids are placeholders
   * and `reports.toDealerDto` only reads the record fields.
   */
  function previewReport(records: RcRecords, fetchedAt: Date): VehicleReport {
    const unpaid = records.challans.filter((row) => row.status === 'UNPAID');
    return {
      id: '00000000-0000-0000-0000-000000000000',
      vehicleId: '00000000-0000-0000-0000-000000000000',
      dealerId: '00000000-0000-0000-0000-000000000000',
      provider: rc.provider,
      fetchedAt,
      blacklistStatus: records.blacklistStatus,
      blacklistReasons: records.blacklistReasons,
      nocIssuedTo: records.nocIssuedTo,
      challansAvailable: records.challansAvailable,
      challanCount: records.challans.length,
      challanUnpaidCount: unpaid.length,
      challanOutstandingPaise: BigInt(unpaid.reduce((sum, row) => sum + row.amountPaise, 0)),
      challans: records.challans as unknown as Prisma.JsonValue,
      financed: records.financed,
      rcStatus: records.rcStatus,
      insuranceUpto: toDateOrNull(records.insuranceUpto),
      fitnessUpto: toDateOrNull(records.fitnessUpto),
      pucUpto: toDateOrNull(records.pucUpto),
      taxUpto: toDateOrNull(records.taxUpto),
      publishedAt: null,
    } satisfies VehicleReport;
  }

  /**
   * What the dealer must be told but which blocks nothing.
   *
   * The transmission line is not an apology for a missing feature — it is the
   * honest statement that a registration certificate does not record a
   * gearbox, and a dealer who is not told will assume the pre-filled form is
   * complete and publish a manual car as an automatic.
   */
  function advisoriesFor(
    basics: RcLookupResponse['basics'],
    records: RcRecords | null,
    reportShown: boolean,
  ): RcLookupResponse['advisories'] {
    const advisories: RcLookupResponse['advisories'] = [];

    advisories.push({
      code: 'TRANSMISSION_UNKNOWN',
      message: 'A registration certificate does not record the gearbox — please confirm it.',
    });

    if (basics.makeId.value === null) {
      advisories.push({
        code: 'MAKE_UNMATCHED',
        message:
          'We found the registration but do not carry that make yet. ' +
          'Choose the closest match, or enter the details by hand.',
      });
    } else if (basics.modelId.confidence !== 'EXACT') {
      advisories.push({
        code: 'MODEL_UNCERTAIN',
        message: 'Check the model — the registration record was not specific enough to be sure.',
      });
    }

    if (!reportShown || !records) return advisories;

    if (records.blacklistStatus === 'BLACKLISTED') {
      advisories.push({
        code: 'VEHICLE_BLACKLISTED',
        message: 'Government records flag this vehicle. Contact us before listing it.',
      });
    }
    if (records.blacklistStatus === 'NOC_ISSUED') {
      advisories.push({
        code: 'NOC_ISSUED',
        message: 'An NOC has been issued for this vehicle — it is mid-transfer between states.',
      });
    }
    if (!records.challansAvailable) {
      advisories.push({
        code: 'CHALLANS_UNAVAILABLE',
        message: 'Challan records were not available for this state. This is not a clear record.',
      });
    } else {
      const unpaid = records.challans.filter((row) => row.status === 'UNPAID');
      if (unpaid.length > 0) {
        advisories.push({
          code: 'CHALLANS_OUTSTANDING',
          message: `${formatRupees(
            unpaid.reduce((sum, row) => sum + row.amountPaise, 0),
          )} in unpaid challans. Clear these before listing.`,
        });
      }
    }

    return advisories;
  }

  return {
    completeness,
    toDto,

    async inventory(dealerId: string, query: InventoryQuery): Promise<InventoryResponse> {
      const rows = await repo.listForDealer(dealerId, {
        ...(query.cursor ? { cursor: decodeCursor(query.cursor) } : {}),
        ...(query.q ? { q: query.q } : {}),
        limit: query.limit,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      const mapped = page.map((vehicle) => toInventoryRow(vehicle));
      const filtered = query.status
        ? mapped.filter((row) => row.displayStatus === query.status)
        : mapped;

      const totalCount = await repo.countForDealer(dealerId);

      // The rejection banner is the one thing a dealer must never have to hunt
      // for. It carries the admin's reason verbatim (§10).
      const attention = mapped.find(
        (row) =>
          (row.displayStatus === 'REJECTED' || row.displayStatus === 'CHANGES_REQUESTED') &&
          row.rejectionReason !== null,
      );

      return {
        data: filtered,
        page: { nextCursor: hasMore && last ? encodeCursor(last.createdAt) : null, hasMore },
        totalCount,
        countLabel: `${totalCount} ${totalCount === 1 ? 'vehicle' : 'vehicles'}`,
        banner:
          attention && attention.listingId
            ? {
                type: attention.displayStatus === 'REJECTED' ? 'REJECTED' : 'CHANGES_REQUESTED',
                listingId: attention.listingId,
                vehicleId: attention.vehicleId,
                title: `${attention.title} was ${
                  attention.displayStatus === 'REJECTED' ? 'rejected' : 'sent back for changes'
                }`,
                reason: attention.rejectionReason ?? '',
                actionLabel: 'Edit & resubmit',
                actionHref: `/dealer/vehicles/${attention.vehicleId}/edit`,
              }
            : null,
      };
    },

    async get(dealerId: string, vehicleId: string): Promise<DealerVehicleDto> {
      const vehicle = await repo.findForDealer(dealerId, vehicleId);
      // 404, never 403 — existence is not leaked across tenants (§7 layer 4).
      if (!vehicle) throw new NotFoundError('That vehicle does not exist.');
      return toDto(vehicle);
    },

    /**
     * C21 — a registration number in, a proposed draft out.
     *
     * Costs money per call, which shapes three things: the flag is checked
     * before anything else, a cached row short-circuits the provider entirely,
     * and the route in front of this is rate-limited per dealer.
     *
     * Nothing is written to the vehicle here. This produces a *proposal* the
     * dealer confirms — a lookup is not a commitment to list the car, and
     * creating a draft per plate typed would fill an inventory with abandoned
     * rows.
     */
    async lookup(dealerId: string, input: RcLookupInput): Promise<RcLookupResponse> {
      if (!(await config.boolean('feature.rcLookup'))) {
        throw new DomainError(
          'RC_LOOKUP_DISABLED',
          'Looking up a vehicle by number plate is not switched on.',
        );
      }

      const reg = input.regNumber;
      const hash = plateHash(reg);
      const cached = await repo.findRcLookup(hash);

      let specs: RcSpecs;
      let records: RcRecords | null;
      let lookupId: string;
      let fetchedAt: Date;

      if (cached) {
        // A cached miss is still an answer: "we asked, there is no RC". It
        // lives an hour rather than a month so a genuinely new registration is
        // not invisible until next month.
        if (!cached.found) throw notFoundForPlate();
        specs = cached.specs as unknown as RcSpecs;
        records = (cached.records as unknown as RcRecords | null) ?? null;
        lookupId = cached.id;
        fetchedAt = cached.fetchedAt;
      } else {
        let result;
        try {
          result = await rc.lookup(reg);
        } catch (error) {
          if (error instanceof RcLookupError && error.kind === 'NOT_FOUND') {
            await cacheMiss(hash);
            throw notFoundForPlate();
          }
          throw translateRcFailure(error);
        }

        specs = result.specs;
        records = result.records;
        const days = await config.number('rcLookup.cacheDays');
        const saved = await repo.saveRcLookup({
          regHash: hash,
          provider: rc.provider,
          specs: specs as unknown as Prisma.InputJsonValue,
          resolved: {},
          records: records as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
          found: true,
        });
        lookupId = saved.id;
        fetchedAt = saved.fetchedAt;
      }

      const basics = await resolveBasics(specs);
      const details = await resolveDetails(specs, reg);

      // Records ride along in the cache row but are only trusted while fresh.
      // Past `report.freshnessHours` the lookup shows no report rather than a
      // stale one — a records claim with a month-old date is worse than none.
      const freshnessHours = await config.number('report.freshnessHours');
      const recordsFresh = Date.now() - fetchedAt.getTime() < freshnessHours * 60 * 60 * 1000;
      const reportEnabled = await config.boolean('feature.vehicleReport');

      /**
       * The cost, abuse and product-gap trail in one line.
       *
       * `matched: false` is the valuable field: grouped by `maker`, it is a
       * free, continuously-updated backlog of which makes the catalogue is
       * missing, sourced from cars dealers actually tried to list rather than
       * from a guess about the market.
       */
      logger.info(
        {
          dealerId,
          provider: rc.provider,
          cached: cached !== null,
          matched: basics.makeId.value !== null,
          maker: specs.makerDescription,
        },
        'rc lookup',
      );

      return {
        lookupId,
        regNumber: reg,
        cached: cached !== null,
        basics,
        details,
        report:
          reportEnabled && records && recordsFresh
            ? await reports.toDealerDto(previewReport(records, fetchedAt))
            : null,
        advisories: advisoriesFor(basics, records, recordsFresh && reportEnabled),
      };
    },

    async create(dealerId: string, input: CreateVehicleInput): Promise<DealerVehicleDto> {
      await assertCatalogue({
        makeId: input.makeId,
        modelId: input.modelId,
        variantId: input.variantId ?? null,
      });

      /**
       * One live car per plate per dealer.
       *
       * The partial unique index added by the rc_lookup migration is the
       * actual guarantee; this read exists so the dealer gets "you already
       * have this car" with a link to it, rather than a constraint violation
       * surfacing as a 500.
       */
      if (input.regNumberMasked) {
        const existing = await repo.findByRegistration(dealerId, input.regNumberMasked);
        if (existing) {
          throw new ConflictError(
            'DUPLICATE_REGISTRATION',
            'You already have this car in your inventory.',
            { errors: [{ field: 'regNumberMasked', code: 'DUPLICATE', message: existing.id }] },
          );
        }
      }

      /**
       * The RC-derived detail fields are applied **here**, from the cached
       * snapshot, rather than accepted from the client.
       *
       * The browser sends one id. The server re-reads what the provider
       * actually said and writes it itself, so a crafted request cannot claim
       * an RC reported one owner and full insurance. It also means the draft
       * and its first report row land in one transaction — a vehicle created
       * from a lookup never exists for a moment with no record of it.
       */
      const snapshot = input.rcLookupId
        ? await loadSnapshot(input.rcLookupId, input.regNumberMasked ?? null)
        : null;

      const prefill = snapshot
        ? await detailColumnsFrom(snapshot.specs, input.regNumberMasked)
        : {};

      const vehicle = await prisma.$transaction(async (tx) => {
        const created = await repo.createIn(tx, dealerId, {
          dealerId,
          makeId: input.makeId,
          modelId: input.modelId,
          variantId: input.variantId ?? null,
          year: input.year,
          fuel: input.fuel,
          transmission: input.transmission,
          bodyType: input.bodyType,
          status: 'DRAFT',
          ...(input.regNumberMasked ? { regNumberMasked: input.regNumberMasked } : {}),
          ...(snapshot ? { rcVerifiedAt: new Date() } : {}),
          ...prefill,
        });

        if (snapshot?.records && (await config.boolean('feature.vehicleReport'))) {
          await reports.append(tx, {
            vehicleId: created.id,
            dealerId,
            records: snapshot.records,
          });
        }

        return created;
      });

      return toDto(vehicle);
    },

    /** C22 — the dealer's records report for one of their vehicles. */
    async report(dealerId: string, vehicleId: string): Promise<VehicleReportDto | null> {
      const vehicle = await repo.findForDealer(dealerId, vehicleId);
      if (!vehicle) throw new NotFoundError('That vehicle does not exist.');
      return reports.latestDto(vehicleId);
    },

    /**
     * C23 — force a re-fetch.
     *
     * Unlike the refresh inside `submit()`, this one surfaces its failure: the
     * dealer pressed a button and deserves to know it did not work, rather
     * than staring at an unchanged date wondering.
     */
    async refreshReport(dealerId: string, vehicleId: string): Promise<VehicleReportDto | null> {
      const vehicle = await repo.findForDealer(dealerId, vehicleId);
      if (!vehicle) throw new NotFoundError('That vehicle does not exist.');

      if (!(await config.boolean('feature.vehicleReport'))) {
        throw new DomainError('REPORT_DISABLED', 'Vehicle records are not switched on.');
      }
      if (!vehicle.regNumberMasked) {
        throw new DomainError(
          'NO_REGISTRATION',
          'Add the registration number first — records are looked up by number plate.',
        );
      }

      try {
        const records = await reports.fetchRecords(vehicle.regNumberMasked);
        await reports.append(prisma, { vehicleId, dealerId, records });
      } catch (error) {
        throw translateRcFailure(error);
      }

      return reports.latestDto(vehicleId);
    },

    async update(
      dealerId: string,
      vehicleId: string,
      input: UpdateVehicleInput,
    ): Promise<DealerVehicleDto> {
      const existing = await repo.findForDealer(dealerId, vehicleId);
      if (!existing) throw new NotFoundError('That vehicle does not exist.');

      const listing = liveListing(existing);
      if (listing && listing.status === 'PENDING_REVIEW') {
        throw new ConflictError(
          'LOCKED_FOR_REVIEW',
          'This listing is with our team. It can be edited once the review is done.',
        );
      }

      /**
       * Coherence is checked against the row **as it will be**, not as it was
       * sent. A PATCH may move the model without naming the make, or the make
       * without naming the model, and either way the pair that ends up stored
       * has to hold together.
       *
       * Skipped entirely when none of the three is being touched: whatever is
       * already stored passed this same check on the way in, so re-reading it on
       * every wizard step would be three queries to learn nothing.
       */
      const touchesTaxonomy =
        input.makeId !== undefined || input.modelId !== undefined || input.variantId !== undefined;

      await assertCatalogue({
        ...(touchesTaxonomy
          ? {
              makeId: input.makeId ?? existing.makeId,
              modelId: input.modelId ?? existing.modelId,
              variantId: input.variantId === undefined ? existing.variantId : input.variantId,
            }
          : {}),
        ...(input.colorId === undefined ? {} : { colorId: input.colorId }),
        ...(input.cityId === undefined ? {} : { cityId: input.cityId }),
      });

      /**
       * The same one-live-car-per-plate rule `create` enforces, applied on the
       * way in through the Details step. Most vehicles get their plate here
       * rather than at creation — a dealer who skipped the lookup types it on
       * this screen — so without this the partial unique index would surface
       * as a 500 on the commonest path of the two.
       *
       * `vehicleId` is excluded: re-sending the plate already on this row is a
       * dealer editing some other field, not a duplicate.
       */
      if (input.regNumberMasked) {
        const clash = await repo.findByRegistration(dealerId, input.regNumberMasked, vehicleId);
        if (clash) {
          throw new ConflictError(
            'DUPLICATE_REGISTRATION',
            'Another car in your inventory already has this registration number.',
            { errors: [{ field: 'regNumberMasked', code: 'DUPLICATE', message: clash.id }] },
          );
        }
      }

      const updated = await repo.update(dealerId, vehicleId, {
        ...(input.makeId === undefined ? {} : { makeId: input.makeId }),
        ...(input.modelId === undefined ? {} : { modelId: input.modelId }),
        ...(input.variantId === undefined ? {} : { variantId: input.variantId ?? null }),
        ...(input.year === undefined ? {} : { year: input.year }),
        ...(input.fuel === undefined ? {} : { fuel: input.fuel }),
        ...(input.transmission === undefined ? {} : { transmission: input.transmission }),
        ...(input.bodyType === undefined ? {} : { bodyType: input.bodyType }),
        ...(input.kmDriven === undefined ? {} : { kmDriven: input.kmDriven }),
        ...(input.ownerNumber === undefined ? {} : { ownerNumber: input.ownerNumber }),
        ...(input.colorId === undefined ? {} : { colorId: input.colorId ?? null }),
        ...(input.seats === undefined ? {} : { seats: input.seats ?? null }),
        ...(input.airbags === undefined ? {} : { airbags: input.airbags ?? null }),
        ...(input.rtoCode === undefined ? {} : { rtoCode: input.rtoCode ?? null }),
        ...(input.cityId === undefined ? {} : { cityId: input.cityId }),
        ...(input.regNumberMasked === undefined
          ? {}
          : { regNumberMasked: input.regNumberMasked ?? null }),
        ...(input.insuranceType === undefined
          ? {}
          : { insuranceType: input.insuranceType ?? null }),
        ...(input.insuranceValidTill === undefined
          ? {}
          : {
              insuranceValidTill: input.insuranceValidTill
                ? new Date(input.insuranceValidTill)
                : null,
            }),
        ...(input.priceNegotiable === undefined ? {} : { priceNegotiable: input.priceNegotiable }),
        // Paise, always. A rupee float here would be the bug rule 3 exists for.
        ...(input.pricePaise === undefined ? {} : { pricePaise: BigInt(input.pricePaise) }),
        ...(input.description === undefined ? {} : { description: input.description ?? null }),
        ...(input.features === undefined ? {} : { features: input.features }),
      });

      if (!updated) throw new NotFoundError('That vehicle does not exist.');
      return toDto(updated);
    },

    async remove(dealerId: string, vehicleId: string): Promise<void> {
      const vehicle = await repo.findForDealer(dealerId, vehicleId);
      if (!vehicle) throw new NotFoundError('That vehicle does not exist.');

      const listing = liveListing(vehicle);
      if (listing?.status === 'APPROVED') {
        throw new ConflictError(
          'CANNOT_DELETE_LIVE',
          'This car is live. Mark it sold, or ask us to take it down, before deleting it.',
        );
      }

      const removed = await repo.softDelete(dealerId, vehicleId);
      if (!removed) throw new NotFoundError('That vehicle does not exist.');
    },

    /**
     * C11 — the core loop. Every guard, the credit hold and the listing row
     * commit together; nothing here can leave a listing PENDING_REVIEW with no
     * hold, or a hold with no listing.
     */
    async submit(
      dealerId: string,
      userId: string,
      vehicleId: string,
    ): Promise<SubmitListingResponse> {
      const [dealer, slaHours, durationDays] = await Promise.all([
        dealers.findById(dealerId),
        config.number('listing.reviewSlaHours'),
        config.number('listing.durationDays'),
      ]);

      if (!dealer) throw new NotFoundError('That dealership no longer exists.');
      if (dealer.status !== 'ACTIVE') {
        throw new ForbiddenError(
          'Your dealership is not active yet. Listings can be published once our team approves it.',
          { code: 'DEALER_NOT_ACTIVE' },
        );
      }

      const missingProfile = profileGaps(dealer);
      if (missingProfile.length > 0) {
        throw new DomainError('PROFILE_INCOMPLETE', 'Complete your dealership profile first.', {
          errors: missingProfile.map((field) => ({
            field,
            code: 'REQUIRED',
            message: `${FIELD_LABELS[field] ?? field} is required before publishing.`,
          })),
        });
      }

      const vehicle = await repo.findForDealer(dealerId, vehicleId);
      if (!vehicle) throw new NotFoundError('That vehicle does not exist.');

      const previous = liveListing(vehicle);
      if (previous && ['PENDING_REVIEW', 'APPROVED'].includes(previous.status)) {
        throw new ConflictError('ALREADY_SUBMITTED', 'This vehicle already has a live listing.');
      }

      /**
       * Records are re-read here, not trusted from intake.
       *
       * A vehicle can be clear when a dealer adds it and flagged three weeks
       * later when they finish the photos, and the report a moderator reviews
       * — and a buyer eventually sees — must be the current one.
       *
       * `refreshIfStale` never throws: a records vendor having a bad afternoon
       * must not stop a dealer publishing a car. It returns the freshest
       * report it has, and a stale one with an honest `asOf` date is a worse
       * report but a truthful one. A failed submission is a lost listing.
       */
      const report = await reports.refreshIfStale(vehicle.id, dealerId, vehicle.regNumberMasked);
      const state = await completeness(vehicle, report);
      const photoBlocker = state.blockers.find((b) => b.code === 'TOO_FEW_PHOTOS');
      if (photoBlocker) {
        throw new DomainError('TOO_FEW_PHOTOS', photoBlocker.message, {
          errors: [{ field: 'photos', code: 'TOO_FEW', message: photoBlocker.message }],
        });
      }
      if (!state.canSubmit) {
        throw new DomainError('VEHICLE_INCOMPLETE', 'This vehicle is missing some details.', {
          errors: state.missing.map((field) => ({
            field,
            code: 'REQUIRED',
            message: `${FIELD_LABELS[field] ?? field} is required.`,
          })),
        });
      }

      const title = [vehicle.year, vehicle.make.name, vehicle.model.name, vehicle.variant?.name]
        .filter(Boolean)
        .join(' ');

      /**
       * A resubmission after `CHANGES_REQUESTED` still holds the credit taken
       * by the first submit — that is the *only* thing separating "request
       * changes" from "reject" (§10, listing lifecycle). Charging again here
       * would make a dealer pay twice for one listing, and would leave
       * `Dealer.creditsHeld` disagreeing with the ledger.
       *
       * Rejection releases the hold, so a resubmit after rejection correctly
       * falls through to a fresh one.
       */
      const reusesHold = previous?.creditHeld === true && previous.creditTxnId !== null;

      const result = await withTenant(prisma, dealerId, async (tx) => {
        let heldTxnId: string;
        let balanceBefore: number;
        let balanceAfter: number;

        if (reusesHold && previous?.creditTxnId) {
          heldTxnId = previous.creditTxnId;
          // No movement: the balance is unchanged because the credit taken by
          // the first submit was never released.
          balanceBefore = await currentBalance(tx, dealerId);
          balanceAfter = balanceBefore;
        } else {
          const balance = await currentBalance(tx, dealerId);
          if (balance < 1) throw new InsufficientCreditsError(1, balance);

          // The hold and the listing are one transaction. Under concurrency the
          // FOR UPDATE inside moveCredits serialises two submits, so a dealer
          // with one credit cannot publish two cars.
          const movement = await moveCredits(tx, {
            dealerId,
            delta: -1,
            reason: 'HOLD_SUBMIT',
            label: `Submitted for review — ${title}`,
            actorType: 'DEALER',
            actorId: userId,
          });
          heldTxnId = movement.transactionId;
          balanceBefore = movement.balanceBefore;
          balanceAfter = movement.balanceAfter;
        }

        const slug = vehicle.slug ?? (await uniqueSlug(vehicle, tx));

        const listing = previous
          ? await tx.listing.update({
              where: { id: previous.id },
              data: {
                status: transition(previous, 'RESUBMIT', 'DEALER'),
                submittedAt: new Date(),
                reviewedAt: null,
                reviewedBy: null,
                rejectionReason: null,
                changeRequestNote: null,
                creditHeld: true,
                creditTxnId: heldTxnId,
              },
            })
          : await tx.listing.create({
              data: {
                vehicleId,
                dealerId,
                status: 'PENDING_REVIEW',
                creditHeld: true,
                creditTxnId: heldTxnId,
              },
            });

        await tx.creditTransaction.update({
          where: { id: heldTxnId },
          data: { listingId: listing.id },
        });

        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { status: 'READY', slug },
        });

        await refreshHeldCount(tx, dealerId);

        await enqueueOutbox(tx, {
          type: 'ListingSubmitted',
          aggregateType: 'Listing',
          aggregateId: listing.id,
          dealerId,
          actor: { type: 'DEALER', id: userId },
          traceId: getContext()?.traceId ?? 'submit',
          payload: { listingId: listing.id, vehicleId },
        });

        return { listing, credit: { heldTxnId, balanceBefore, balanceAfter } };
      });

      const expectedReviewBy = new Date(Date.now() + slaHours * 3600 * 1000);

      return {
        listingId: result.listing.id,
        status: 'PENDING_REVIEW',
        displayStatus: 'PENDING',
        statusLabel: 'Pending approval',
        submittedAt: result.listing.submittedAt.toISOString(),
        expectedReviewBy: expectedReviewBy.toISOString(),
        credit: {
          held: 1,
          balanceBefore: result.credit.balanceBefore,
          balanceAfter: result.credit.balanceAfter,
          transactionId: result.credit.heldTxnId,
          note: `One credit is held now and spent when the listing is approved. If we reject it, the credit returns to your balance. Approved listings stay live for ${durationDays} days.`,
        },
        message: `Your listing is with our team. Most listings are reviewed within ${slaHours} hours.`,
      };
    },

    /**
     * C12. The credit is **not** refunded — the listing did its job.
     *
     * The car stays on the marketplace, which is the part worth stating: this
     * used to end with `unindex`, and now the outbox re-indexes instead so the
     * row survives with `is_sold = true`. Sold cars are shown, badged and
     * unclickable, and every "cars available" count skips them.
     */
    async markSold(
      dealerId: string,
      vehicleId: string,
      input: MarkSoldInput,
    ): Promise<MarkSoldResponse> {
      const vehicle = await repo.findForDealer(dealerId, vehicleId);
      if (!vehicle) throw new NotFoundError('That vehicle does not exist.');

      const listing = liveListing(vehicle);
      if (!listing) {
        throw new ConflictError('INVALID_TRANSITION', 'This vehicle has never been published.');
      }

      const soldAt = input.soldAt ? new Date(input.soldAt) : new Date();

      await withTenant(prisma, dealerId, async (tx) => {
        await tx.listing.update({
          where: { id: listing.id },
          data: { status: transition(listing, 'MARK_SOLD', 'DEALER'), soldAt },
        });
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: {
            status: 'SOLD',
            ...(input.soldPricePaise === undefined
              ? {}
              : { soldPricePaise: BigInt(input.soldPricePaise) }),
          },
        });
        await refreshActiveListings(tx, dealerId);

        await enqueueOutbox(tx, {
          type: 'VehicleSold',
          aggregateType: 'Listing',
          aggregateId: listing.id,
          dealerId,
          actor: { type: 'DEALER' },
          traceId: getContext()?.traceId ?? 'sold',
          payload: { listingId: listing.id, vehicleId },
        });
      });

      return {
        displayStatus: 'SOLD',
        statusLabel: 'Sold',
        markedSoldAt: soldAt.toISOString(),
        remainsVisible: true,
        message:
          'Marked sold. The car stays on the marketplace with a Sold badge — buyers can see it ' +
          'but not open or enquire about it. Remove the listing if you would rather it went.',
      };
    },

    /**
     * C12b — the dealer withdrawing their own listing.
     *
     * Distinct from `remove` (C10), which soft-deletes the *vehicle* and 409s
     * while a listing is live. This ends the publication and keeps the asset:
     * the listing goes REMOVED with `removedAt` set, so the inventory and the
     * ledger still show that this car was once advertised and what it cost,
     * and the vehicle drops back to DRAFT where it can be edited and, for a
     * fresh credit, submitted again.
     *
     * The consumed credit is not returned. The listing ran; withdrawing it
     * early is the dealer's choice, and refunding here would make "publish,
     * withdraw, republish" a way to advertise indefinitely for one credit.
     */
    async removeListing(dealerId: string, vehicleId: string): Promise<RemoveListingResponse> {
      const vehicle = await repo.findForDealer(dealerId, vehicleId);
      if (!vehicle) throw new NotFoundError('That vehicle does not exist.');

      const listing = liveListing(vehicle);
      if (!listing) {
        throw new ConflictError('INVALID_TRANSITION', 'This vehicle has never been published.');
      }

      const removedAt = new Date();
      // A car that was sold stays sold. Withdrawing its listing takes it off
      // the marketplace; it does not un-sell it, and resetting the vehicle to
      // DRAFT here would quietly relist a car that is gone.
      const wasSold = listing.status === 'SOLD' || vehicle.status === 'SOLD';

      await withTenant(prisma, dealerId, async (tx) => {
        await tx.listing.update({
          where: { id: listing.id },
          data: { status: transition(listing, 'WITHDRAW', 'DEALER'), removedAt },
        });
        if (!wasSold) {
          await tx.vehicle.update({ where: { id: vehicleId }, data: { status: 'DRAFT' } });
        }
        await refreshActiveListings(tx, dealerId);

        await enqueueOutbox(tx, {
          type: 'ListingRemoved',
          aggregateType: 'Listing',
          aggregateId: listing.id,
          dealerId,
          actor: { type: 'DEALER' },
          traceId: getContext()?.traceId ?? 'remove-listing',
          payload: { listingId: listing.id, vehicleId, withdrawnByDealer: true },
        });
      });

      return {
        displayStatus: 'REMOVED',
        statusLabel: 'Removed',
        removedAt: removedAt.toISOString(),
        vehicleRetained: true,
        canRelist: !wasSold,
        message: wasSold
          ? 'Removed from the marketplace. The sale stays on your record.'
          : 'Removed from the marketplace. The car is back in your inventory as a draft — ' +
            'submitting it again costs one credit.',
      };
    },

    /**
     * C13. A renewal costs a fresh credit and re-enters PENDING_REVIEW — never
     * straight to APPROVED, because 90-day-old photos and a 90-day-old price
     * both deserve a second look (§10).
     */
    async renew(
      dealerId: string,
      userId: string,
      listingId: string,
    ): Promise<RenewListingResponse> {
      const listing = await prisma.listing.findFirst({
        where: { id: listingId, dealerId },
        include: { vehicle: { include: { make: true, model: true, variant: true } } },
      });
      if (!listing) throw new NotFoundError('That listing does not exist.');

      const title = [
        listing.vehicle.year,
        listing.vehicle.make.name,
        listing.vehicle.model.name,
        listing.vehicle.variant?.name,
      ]
        .filter(Boolean)
        .join(' ');

      const result = await withTenant(prisma, dealerId, async (tx) => {
        const balance = await currentBalance(tx, dealerId);
        if (balance < 1) throw new InsufficientCreditsError(1, balance);

        const movement = await moveCredits(tx, {
          dealerId,
          delta: -1,
          reason: 'HOLD_SUBMIT',
          label: `Renewal submitted — ${title}`,
          actorType: 'DEALER',
          actorId: userId,
        });

        const renewed = await tx.listing.create({
          data: {
            vehicleId: listing.vehicleId,
            dealerId,
            status: transition(listing, 'RENEW', 'DEALER'),
            creditHeld: true,
            creditTxnId: movement.transactionId,
            renewedFromId: listing.id,
          },
        });

        await tx.creditTransaction.update({
          where: { id: movement.transactionId },
          data: { listingId: renewed.id },
        });
        await refreshHeldCount(tx, dealerId);

        await enqueueOutbox(tx, {
          type: 'ListingSubmitted',
          aggregateType: 'Listing',
          aggregateId: renewed.id,
          dealerId,
          actor: { type: 'DEALER', id: userId },
          traceId: getContext()?.traceId ?? 'renew',
          payload: { listingId: renewed.id, vehicleId: listing.vehicleId },
        });

        return { renewed, movement };
      });

      return {
        listingId: result.renewed.id,
        status: 'PENDING_REVIEW',
        displayStatus: 'PENDING',
        renewedFromId: listing.id,
        credit: {
          held: 1,
          balanceBefore: result.movement.balanceBefore,
          balanceAfter: result.movement.balanceAfter,
        },
        message: 'Renewed listings are reviewed again before they go live.',
      };
    },
  };
}

export type VehiclesService = ReturnType<typeof createVehiclesService>;

const FIELD_LABELS: Record<string, string> = {
  makeId: 'Make',
  modelId: 'Model',
  variantId: 'Variant',
  year: 'Year',
  fuel: 'Fuel',
  transmission: 'Transmission',
  bodyType: 'Body type',
  kmDriven: 'KM driven',
  ownerNumber: 'Ownership',
  colorId: 'Colour',
  rtoCode: 'RTO',
  insuranceType: 'Insurance',
  insuranceValidTill: 'Insurance valid till',
  regNumberMasked: 'Registration number',
  cityId: 'Location',
  pricePaise: 'Asking price',
  description: 'Description (at least 100 characters)',
  photos: 'Photos',
  brandName: 'Dealership name',
  legalName: 'Registered legal name',
  gstin: 'GSTIN',
  addressLine: 'Address',
  cityId_dealer: 'City',
};

function profileGaps(dealer: {
  brandName: string;
  legalName: string;
  gstin: string | null;
  addressLine: string | null;
  cityId: string | null;
}): string[] {
  const gaps: string[] = [];
  if (!dealer.brandName) gaps.push('brandName');
  if (!dealer.legalName) gaps.push('legalName');
  if (!dealer.gstin) gaps.push('gstin');
  if (!dealer.addressLine) gaps.push('addressLine');
  if (!dealer.cityId) gaps.push('cityId_dealer');
  return gaps;
}

function toMediaDto(primaryMediaId: string | null) {
  return (entry: VehicleWithRelations['media'][number]): VehicleMediaDto => ({
    mediaId: entry.media.id,
    position: entry.position,
    isPrimary: entry.media.id === primaryMediaId,
    status: toMediaStatus(entry.media.status),
    url: entry.media.status === 'READY' ? mediaUrl(entry.media.id, 640) : null,
    blurhash: entry.media.blurhash,
    width: entry.media.width,
    height: entry.media.height,
    fileName: entry.media.fileName,
    warnings: entry.media.warnings,
    uploadedByAdmin: entry.media.uploadedByAdmin,
  });
}

type InventoryRowWithMeta = InventoryRow & { createdAt: Date };

function toInventoryRow(vehicle: VehicleWithRelations): InventoryRowWithMeta {
  const listing = vehicle.listings[0] ?? null;
  const status = displayStatus(vehicle, listing);
  const primary =
    vehicle.media.find((entry) => entry.media.id === vehicle.primaryMediaId) ?? vehicle.media[0];

  const title = [vehicle.year, vehicle.make.name, vehicle.model.name, vehicle.variant?.name]
    .filter(Boolean)
    .join(' ');

  const kmLabel = vehicle.kmDriven === null ? '—' : formatKm(vehicle.kmDriven);
  const fuelLabel = FUEL_LABELS[vehicle.fuel];

  return {
    createdAt: vehicle.createdAt,
    vehicleId: vehicle.id,
    listingId: listing?.id ?? null,
    title,
    thumbnailUrl: primary ? mediaUrl(primary.media.id, 320) : null,
    pricePaise: vehicle.pricePaise === null ? null : Number(vehicle.pricePaise),
    priceLabel: vehicle.pricePaise === null ? '—' : formatLakh(vehicle.pricePaise),
    kmLabel,
    fuelLabel,
    metaLabel: [kmLabel, fuelLabel].filter((part) => part !== '—').join(' · '),
    displayStatus: status,
    statusLabel: DISPLAY_STATUS_LABELS[status],
    statusTone: DISPLAY_STATUS_TONES[status],
    views: listing?.viewCount ?? 0,
    enquiries: listing?.enquiryCount ?? 0,
    expiresAt: listing?.expiresAt?.toISOString() ?? null,
    expiryLabel: listing?.expiresAt ? formatDate(listing.expiresAt) : '—',
    submittedLabel: status === 'PENDING' && listing ? timeAgo(listing.submittedAt) : null,
    rejectionReason: listing?.rejectionReason ?? listing?.changeRequestNote ?? null,
    canEdit: EDITABLE.has(status),
    canResubmit: status === 'REJECTED' || status === 'CHANGES_REQUESTED',
    canRenew: status === 'EXPIRED',
    canMarkSold: status === 'ACTIVE' || status === 'EXPIRED',
    canRemoveListing: WITHDRAWABLE.has(status),
    canDelete: status !== 'ACTIVE',
    isPubliclyVisible: PUBLIC.has(status),
  };
}

const EDITABLE = new Set<DisplayStatus>([
  'DRAFT',
  'REJECTED',
  'CHANGES_REQUESTED',
  'EXPIRED',
  'ACTIVE',
  // A withdrawn listing leaves an editable vehicle behind — that is the whole
  // point of withdrawing rather than deleting.
  'REMOVED',
]);

/** Mirrors the WITHDRAW rule in `listing.state.ts`, in display terms. */
const WITHDRAWABLE = new Set<DisplayStatus>(['ACTIVE', 'EXPIRED', 'SOLD']);

/** What a buyer can still see. A sold car is visible; a removed one is not. */
const PUBLIC = new Set<DisplayStatus>(['ACTIVE', 'SOLD']);

/**
 * `/car/{year}-{make}-{model}-{variant}-{city}-{6charId}` (§17.1). Never 404 a
 * URL Google has indexed, so a slug is assigned once and then kept.
 */
async function uniqueSlug(
  vehicle: VehicleWithRelations,
  tx: { vehicle: { findUnique: (args: { where: { slug: string } }) => Promise<unknown> } },
): Promise<string> {
  const base = slugify(
    [vehicle.year, vehicle.make.name, vehicle.model.name, vehicle.variant?.name, vehicle.city?.slug]
      .filter(Boolean)
      .join(' '),
  );

  let candidate = `${base}-${vehicle.id.slice(0, 6)}`;
  let suffix = 1;
  while (await tx.vehicle.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${vehicle.id.slice(0, 6)}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
