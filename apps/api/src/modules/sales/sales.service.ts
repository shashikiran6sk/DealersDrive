import { resolveOnboardingLocation } from '../service-locations/service-locations.facade.js';
import {
  DEALER_STATUS_LABELS,
  formatPhone,
  normaliseLocality,
  type CreateAssistedDealerInput,
  type CreateVehicleInput,
  type DealerDocType,
  type DocumentCommitInput,
  type DocumentPresignInput,
  type SalesDashboard,
  type SalesDealerDetail,
  type SalesDealerSummary,
  type SalesDealersQuery,
  type SalesDealersResponse,
  type SalesPhoneVerifyInput,
  type SalesPhoneVerifyResponse,
  type SalesVehiclesResponse,
  type StatusTone,
  type UpdateAssistedDealerInput,
  type PhoneOtpWidget,
  type UpdateDealerInput,
  type UpdateVehicleInput,
  type YardPhotoCommitInput,
  type YardPhotoPresignInput,
} from '@dealers-drive/contracts';
import type { DealerStatus, Prisma, PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import type { Tx } from '../../platform/db/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../platform/errors.js';
import type { MapsPort } from '../../platform/maps/maps-link.js';
import type { PhoneOtpPort } from '../../platform/phone-otp/phone-otp.port.js';
import { logger } from '../../platform/telemetry/logger.js';
import type { AdminPrincipal, PhoneProofService } from '../auth/auth.facade.js';
import { requestEmailVerification, withinCooldown } from '../dealer-claims/dealer-claims.facade.js';
import {
  uniqueDealerSlug,
  normaliseDealerEmail,
  withDealerEmailConflict,
  assertDealerEmailFree,
  type DealersService,
} from '../dealers/dealers.facade.js';
import type { AssistedVehicleActor, VehiclesService } from '../vehicles/vehicles.facade.js';
import {
  issueAssistedPhoneTicket,
  redeemAssistedPhoneTicket,
  openAssistedPhoneTicket,
} from './assisted-phone-ticket.js';
import {
  ASSISTED_DEALER_LOCKED,
  ASSISTED_DEALER_NOT_FOUND,
  DEALER_PHONE_TAKEN,
  SALES_APPROVED_LABEL,
  VERIFICATION_COOLDOWN,
  VERIFICATION_NO_EMAIL,
  VERIFICATION_NOT_EDITABLE,
} from './sales.messages.js';

export interface SalesDeps {
  prisma: PrismaClient;
  audit: AuditService;
  cache: CachePort;
  proof: Pick<PhoneProofService, 'prove' | 'widget'>;
  otpDriver: PhoneOtpPort['driver'];
  maps: MapsPort;
  dealers: DealersService;
  vehicles: VehiclesService;
}

const OPEN_DEALER_STATUSES: readonly DealerStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
];

const STATUS_TONE: Readonly<Record<DealerStatus, StatusTone>> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warn',
  ACTIVE: 'ok',
  SUSPENDED: 'err',
  REJECTED: 'err',
  CLOSED: 'neutral',
};

const RECENT_LIMIT = 5;

const SUMMARY_SELECT = {
  id: true,
  legalName: true,
  city: true,
  district: true,
  status: true,
  statusReason: true,
  contactName: true,
  contactPhone: true,
  contactPhoneVerifiedAt: true,
  contactEmailVerifiedAt: true,
  createdAt: true,
  members: { where: { status: 'ACTIVE', role: 'OWNER' }, select: { id: true } },
} satisfies Prisma.DealerSelect;

type SummaryRow = Prisma.DealerGetPayload<{ select: typeof SUMMARY_SELECT }>;

type ListingCounts = SalesDealerSummary['listings'];

function memberOf(principal: AdminPrincipal): string {
  if (!principal.memberId) {
    throw new ForbiddenError('Sign in with your own team account to use the Sales workspace.');
  }
  return principal.memberId;
}

function phoneTaken(): ConflictError {
  return new ConflictError('DEALER_PHONE_TAKEN', DEALER_PHONE_TAKEN, {
    errors: [{ field: 'body.phone', code: 'DEALER_PHONE_TAKEN', message: DEALER_PHONE_TAKEN }],
  });
}

const CLOSED_FOR_LISTINGS: readonly DealerStatus[] = ['SUSPENDED', 'REJECTED', 'CLOSED'];

function assistedActor(principal: AdminPrincipal, dealerId: string): AssistedVehicleActor {
  return { dealerId, userId: principal.userId, memberId: memberOf(principal) };
}

function emptyCounts(): ListingCounts {
  return { draft: 0, review: 0, live: 0 };
}

export function createSalesService({
  prisma,
  audit,
  cache,
  proof,
  otpDriver,
  maps,
  dealers,
  vehicles,
}: SalesDeps) {
  async function assertPhoneFree(db: PrismaClient | Tx, phone: string): Promise<void> {
    const [dealer, member] = await Promise.all([
      db.dealer.findFirst({
        where: { contactPhone: phone, status: { in: [...OPEN_DEALER_STATUSES] } },
        select: { id: true },
      }),
      db.dealerMember.findFirst({
        where: {
          status: 'ACTIVE',
          user: { phone },
          dealer: { status: { in: [...OPEN_DEALER_STATUSES] } },
        },
        select: { id: true },
      }),
    ]);
    if (dealer || member) throw phoneTaken();
  }

  async function listingCounts(dealerIds: readonly string[]): Promise<Map<string, ListingCounts>> {
    const counts = new Map<string, ListingCounts>();
    if (dealerIds.length === 0) return counts;
    const grouped = await prisma.listing.groupBy({
      by: ['dealerId', 'status'],
      where: { dealerId: { in: [...dealerIds] } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      const entry = counts.get(row.dealerId) ?? emptyCounts();
      if (row.status === 'DRAFT' || row.status === 'CHANGES_REQUESTED') {
        entry.draft += row._count._all;
      } else if (row.status === 'PENDING_REVIEW') {
        entry.review += row._count._all;
      } else if (row.status === 'ACTIVE' || row.status === 'RESERVED') {
        entry.live += row._count._all;
      }
      counts.set(row.dealerId, entry);
    }
    return counts;
  }

  function toSummary(row: SummaryRow, counts: ListingCounts): SalesDealerSummary {
    return {
      id: row.id,
      legalName: row.legalName,
      city: row.city,
      district: row.district,
      status: row.status,
      statusLabel:
        row.status === 'ACTIVE' ? SALES_APPROVED_LABEL : DEALER_STATUS_LABELS[row.status],
      statusTone: STATUS_TONE[row.status],
      statusReason: row.statusReason,
      contactName: row.contactName,
      phoneDisplay: row.contactPhone ? formatPhone(row.contactPhone) : '',
      phoneVerified: row.contactPhoneVerifiedAt !== null,
      emailVerified: row.contactEmailVerifiedAt !== null,
      claimed: row.members.length > 0,
      createdAt: row.createdAt.toISOString(),
      listings: counts,
    };
  }

  async function requireAssisted(
    principal: AdminPrincipal,
    dealerId: string,
    db: PrismaClient | Tx = prisma,
  ) {
    const memberId = memberOf(principal);
    const dealer = await db.dealer.findFirst({
      where: { id: dealerId, assistedByMemberId: memberId },
      select: SUMMARY_SELECT,
    });
    if (!dealer) {
      throw new NotFoundError(ASSISTED_DEALER_NOT_FOUND, { code: 'ASSISTED_DEALER_NOT_FOUND' });
    }
    return dealer;
  }

  async function requireEditable(
    principal: AdminPrincipal,
    dealerId: string,
    db: PrismaClient | Tx = prisma,
  ): Promise<void> {
    const dealer = await requireAssisted(principal, dealerId, db);
    if (dealer.status !== 'DRAFT' || dealer.members.length > 0) {
      throw new ConflictError('ASSISTED_DEALER_LOCKED', ASSISTED_DEALER_LOCKED);
    }
  }

  async function detail(principal: AdminPrincipal, dealerId: string): Promise<SalesDealerDetail> {
    const summary = await requireAssisted(principal, dealerId);
    const [dealer, counts, completeness, documents, yardPhoto, verification] = await Promise.all([
      prisma.dealer.findUniqueOrThrow({ where: { id: dealerId } }),
      listingCounts([dealerId]),
      dealers.completeness(dealerId),
      dealers.documents(dealerId),
      dealers.yardPhoto(dealerId),
      prisma.dealerEmailVerification.findFirst({
        where: { dealerId },
        orderBy: { createdAt: 'desc' },
        select: {
          email: true,
          createdAt: true,
          sentAt: true,
          expiresAt: true,
          verifiedAt: true,
          claimedAt: true,
        },
      }),
    ]);
    const editable = summary.status === 'DRAFT' && summary.members.length === 0;

    return {
      ...toSummary(summary, counts.get(dealerId) ?? emptyCounts()),
      email: dealer.contactEmail,
      gstin: dealer.gstin,
      pan: dealer.pan,
      tagline: dealer.tagline,
      specialities: dealer.specialities,
      landline: dealer.landline,
      address: {
        line: dealer.addressLine,
        city: dealer.city,
        district: dealer.district,
        state: dealer.state,
        pincode: dealer.pincode,
        mapsUrl: dealer.mapsUrl,
      },
      consentAt: dealer.assistedConsentAt?.toISOString() ?? null,
      phoneVerifiedAt: dealer.contactPhoneVerifiedAt?.toISOString() ?? null,
      completeness,
      documents: documents.data,
      yardPhoto,
      canEdit: editable,
      canSubmit: editable && completeness.canSubmit,
      emailVerification: verification
        ? {
            email: verification.email,
            sentAt: verification.sentAt?.toISOString() ?? null,
            expiresAt: verification.expiresAt?.toISOString() ?? null,
            verifiedAt: verification.verifiedAt?.toISOString() ?? null,
            claimedAt: verification.claimedAt?.toISOString() ?? null,
            canResend: summary.members.length === 0 && !withinCooldown(verification),
          }
        : null,
    };
  }

  return {
    widget(): PhoneOtpWidget {
      return proof.widget();
    },

    async dashboard(principal: AdminPrincipal): Promise<SalesDashboard> {
      const memberId = memberOf(principal);
      const [member, statuses, recent] = await Promise.all([
        prisma.adminMember.findUniqueOrThrow({
          where: { id: memberId },
          select: { user: { select: { fullName: true, email: true } } },
        }),
        prisma.dealer.groupBy({
          by: ['status'],
          where: { assistedByMemberId: memberId },
          _count: { _all: true },
        }),
        prisma.dealer.findMany({
          where: { assistedByMemberId: memberId },
          select: SUMMARY_SELECT,
          orderBy: { createdAt: 'desc' },
          take: RECENT_LIMIT,
        }),
      ]);

      const byStatus = new Map(statuses.map((row) => [row.status, row._count._all]));
      const all = await prisma.dealer.findMany({
        where: { assistedByMemberId: memberId },
        select: { id: true },
      });
      const counts = await listingCounts(all.map((row) => row.id));
      const totals = [...counts.values()].reduce(
        (sum, entry) => ({
          draft: sum.draft + entry.draft,
          review: sum.review + entry.review,
          live: sum.live + entry.live,
        }),
        emptyCounts(),
      );
      const rejected = await prisma.auditLog.count({
        where: {
          action: 'dealer.rejected',
          before: { path: ['assistedByMemberId'], equals: memberId },
        },
      });

      return {
        member: { name: member.user.fullName, email: member.user.email ?? '' },
        metrics: [
          {
            key: 'onboarded',
            label: 'Dealerships onboarded',
            value: all.length + rejected,
            href: '/sales/dealers',
          },
          {
            key: 'pending',
            label: 'Pending verification',
            value: byStatus.get('PENDING_APPROVAL') ?? 0,
            href: '/sales/dealers?status=PENDING_APPROVAL',
          },
          {
            key: 'approved',
            label: 'Approved dealerships',
            value: byStatus.get('ACTIVE') ?? 0,
            href: '/sales/dealers?status=ACTIVE',
          },
          { key: 'draftListings', label: 'Draft listings', value: totals.draft, href: null },
          {
            key: 'reviewListings',
            label: 'Listings under review',
            value: totals.review,
            href: null,
          },
          { key: 'liveListings', label: 'Live listings', value: totals.live, href: null },
        ],
        recent: recent.map((row) => toSummary(row, counts.get(row.id) ?? emptyCounts())),
      };
    },

    async dealers(
      principal: AdminPrincipal,
      query: SalesDealersQuery,
    ): Promise<SalesDealersResponse> {
      const memberId = memberOf(principal);
      const [rows, statuses] = await Promise.all([
        prisma.dealer.findMany({
          where: {
            assistedByMemberId: memberId,
            ...(query.status ? { status: query.status } : {}),
          },
          select: SUMMARY_SELECT,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.dealer.groupBy({
          by: ['status'],
          where: { assistedByMemberId: memberId },
          _count: { _all: true },
        }),
      ]);
      const counts = await listingCounts(rows.map((row) => row.id));
      const statusCounts: Record<string, number> = { ALL: 0 };
      for (const row of statuses) {
        statusCounts[row.status] = row._count._all;
        statusCounts.ALL = (statusCounts.ALL ?? 0) + row._count._all;
      }
      return {
        data: rows.map((row) => toSummary(row, counts.get(row.id) ?? emptyCounts())),
        counts: statusCounts,
      };
    },

    async verifyPhone(
      principal: AdminPrincipal,
      input: SalesPhoneVerifyInput,
      context: { ip?: string | undefined } = {},
    ): Promise<SalesPhoneVerifyResponse> {
      const memberId = memberOf(principal);
      const { phone, provenAt } = await proof.prove({
        phone: input.phone,
        accessToken: input.accessToken,
        purpose: 'ASSISTED_DEALER_PHONE',
        userId: principal.userId,
        ip: context.ip,
      });
      await assertPhoneFree(prisma, phone);

      const ticket = issueAssistedPhoneTicket(phone, memberId, provenAt.getTime());

      await audit.recordDetached({
        actorType: 'ADMIN',
        actorId: principal.userId,
        action: 'dealer.assisted.phone_verified',
        entityType: 'AdminMember',
        entityId: memberId,
        after: { phoneLast4: phone.slice(-4), consent: true, verifiedAt: provenAt.toISOString() },
      });
      logger.info(
        { event: 'sales.phone.verified', adminMemberId: memberId, driver: otpDriver },
        'dealer phone verified for assisted onboarding',
      );

      return {
        phone,
        phoneDisplay: formatPhone(phone),
        verifiedAt: provenAt.toISOString(),
        phoneTicket: ticket.token,
        expiresAt: ticket.expiresAt.toISOString(),
      };
    },

    async create(
      principal: AdminPrincipal,
      input: CreateAssistedDealerInput,
    ): Promise<SalesDealerDetail> {
      const memberId = memberOf(principal);
      if (openAssistedPhoneTicket(input.phoneTicket, memberId)) {
        await assertDealerEmailFree(prisma, input.email);
      }
      const ticket = await redeemAssistedPhoneTicket(cache, input.phoneTicket, memberId);

      const city = normaliseLocality(input.city);
      const district = normaliseLocality(input.district);
      const state = normaliseLocality(input.state);

      const nameOwner = await prisma.dealer.findFirst({
        where: {
          legalName: { equals: input.legalName, mode: 'insensitive' },
          city: { equals: city, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (nameOwner) {
        throw new ConflictError(
          'DEALER_NAME_TAKEN',
          `A dealership called ${input.legalName} is already registered in ${city}.`,
          {
            errors: [
              {
                field: 'body.legalName',
                code: 'DEALER_NAME_TAKEN',
                message: `Already registered in ${city}.`,
              },
            ],
          },
        );
      }

      const place = await maps.placeFor(input.mapsUrl);
      const consentAt = new Date(ticket.provenAt);

      const email = normaliseDealerEmail(input.email);
      const created = await withDealerEmailConflict(() =>
        withTransaction(prisma, async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assisted-phone:${ticket.phone}`}))`;
          await assertPhoneFree(tx, ticket.phone);

          const location = await resolveOnboardingLocation(tx, state, district);
          const dealer = await tx.dealer.create({
            data: {
              slug: await uniqueDealerSlug(tx, {
                legalName: input.legalName,
                city,
                district: location.district,
                state: location.state,
              }),
              brandName: input.legalName,
              legalName: input.legalName,
              status: 'DRAFT',
              city,
              ...location,
              addressLine: input.addressLine,
              pincode: input.pincode,
              mapsUrl: input.mapsUrl,
              lat: place.coordinates?.lat ?? null,
              lng: place.coordinates?.lng ?? null,
              mapsPlaceId: place.placeId,
              contactName: input.contactName,
              contactPhone: ticket.phone,
              contactPhoneVerifiedAt: consentAt,
              contactEmail: email,
              contactEmailVerifiedAt: null,
              landline: input.landline ?? null,
              tagline: input.tagline,
              specialities: input.specialities,
              gstin: input.gstin ?? null,
              pan: input.pan ?? null,
              onboardingSource: 'ASSISTED',
              assistedByMemberId: memberId,
              assistedConsentAt: consentAt,
            },
          });

          await tx.dealerDocument.createMany({
            data: (['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'] as const).map((type) => ({
              dealerId: dealer.id,
              type,
              status: 'REQUIRED' as const,
            })),
          });

          await audit.record(tx, {
            actorType: 'ADMIN',
            actorId: principal.userId,
            dealerId: dealer.id,
            action: 'dealer.assisted.created',
            entityType: 'Dealer',
            entityId: dealer.id,
            after: {
              slug: dealer.slug,
              status: dealer.status,
              onboardingSource: 'ASSISTED',
              assistedByMemberId: memberId,
              phoneVerifiedAt: consentAt.toISOString(),
              consentAt: consentAt.toISOString(),
              emailVerified: false,
            },
          });
          await requestEmailVerification(tx, {
            dealerId: dealer.id,
            email,
            memberId,
            actorUserId: principal.userId,
          });

          return dealer;
        }),
      );

      logger.info(
        { event: 'sales.dealer.created', adminMemberId: memberId, dealerId: created.id },
        'assisted dealership created',
      );
      return detail(principal, created.id);
    },

    detail,

    async update(
      principal: AdminPrincipal,
      dealerId: string,
      input: UpdateAssistedDealerInput,
    ): Promise<SalesDealerDetail> {
      await requireEditable(principal, dealerId);
      const email = input.email === undefined ? undefined : normaliseDealerEmail(input.email);

      const patch: UpdateDealerInput = {
        ...(input.legalName === undefined ? {} : { legalName: input.legalName }),
        ...(input.tagline === undefined ? {} : { tagline: input.tagline }),
        ...(input.gstin === undefined ? {} : { gstin: input.gstin }),
        ...(input.pan === undefined ? {} : { pan: input.pan }),
        ...(input.specialities === undefined ? {} : { specialities: input.specialities }),
        ...(input.email === undefined && input.landline === undefined
          ? {}
          : {
              contact: {
                ...(email === undefined ? {} : { email }),
                ...(input.landline === undefined ? {} : { landline: input.landline }),
              },
            }),
        ...(input.addressLine === undefined &&
        input.city === undefined &&
        input.district === undefined &&
        input.state === undefined &&
        input.pincode === undefined &&
        input.mapsUrl === undefined
          ? {}
          : {
              address: {
                ...(input.addressLine === undefined ? {} : { line: input.addressLine }),
                ...(input.city === undefined ? {} : { city: input.city }),
                ...(input.district === undefined ? {} : { district: input.district }),
                ...(input.state === undefined ? {} : { state: input.state }),
                ...(input.pincode === undefined ? {} : { pincode: input.pincode }),
                ...(input.mapsUrl === undefined ? {} : { mapsUrl: input.mapsUrl }),
              },
            }),
      };

      await withDealerEmailConflict(() =>
        withTransaction(prisma, async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "dealers" WHERE "id" = ${dealerId}::uuid FOR UPDATE`;
          await requireEditable(principal, dealerId, tx);
          const current = await tx.dealer.findUniqueOrThrow({ where: { id: dealerId } });
          const emailChanged = email !== undefined && email !== current.contactEmail;
          await dealers.amendDraft(dealerId, patch, tx);
          if (input.contactName !== undefined || emailChanged) {
            await tx.dealer.update({
              where: { id: dealerId },
              data: {
                ...(input.contactName === undefined ? {} : { contactName: input.contactName }),
                ...(emailChanged ? { contactEmailVerifiedAt: null } : {}),
              },
            });
          }
          await audit.record(tx, {
            actorType: 'ADMIN',
            actorId: principal.userId,
            dealerId,
            action: 'dealer.assisted.updated',
            entityType: 'Dealer',
            entityId: dealerId,
            after: { fields: Object.keys(input), emailChanged },
          });
          if (emailChanged && email) {
            await requestEmailVerification(tx, {
              dealerId,
              email,
              memberId: memberOf(principal),
              actorUserId: principal.userId,
            });
          }
        }),
      );

      return detail(principal, dealerId);
    },

    async presignDocument(
      principal: AdminPrincipal,
      dealerId: string,
      input: DocumentPresignInput,
    ) {
      await requireEditable(principal, dealerId);
      return dealers.presignDocument(dealerId, input);
    },

    async commitDocument(
      principal: AdminPrincipal,
      dealerId: string,
      type: DealerDocType,
      input: DocumentCommitInput,
    ) {
      await requireEditable(principal, dealerId);
      return dealers.commitDocument(dealerId, type, input);
    },

    async deleteDocument(principal: AdminPrincipal, dealerId: string, type: DealerDocType) {
      await requireEditable(principal, dealerId);
      await dealers.deleteDocument(dealerId, type);
    },

    async presignYardPhoto(
      principal: AdminPrincipal,
      dealerId: string,
      input: YardPhotoPresignInput,
    ) {
      await requireEditable(principal, dealerId);
      return dealers.presignYardPhoto(dealerId, input);
    },

    async commitYardPhoto(
      principal: AdminPrincipal,
      dealerId: string,
      input: YardPhotoCommitInput,
    ) {
      await requireEditable(principal, dealerId);
      return dealers.commitYardPhoto(dealerId, input);
    },

    async deleteYardPhoto(principal: AdminPrincipal, dealerId: string) {
      await requireEditable(principal, dealerId);
      await dealers.deleteYardPhoto(dealerId);
    },

    async resendEmailVerification(
      principal: AdminPrincipal,
      dealerId: string,
    ): Promise<SalesDealerDetail> {
      const memberId = memberOf(principal);
      const summary = await requireAssisted(principal, dealerId);
      if (summary.members.length > 0) {
        throw new ConflictError('VERIFICATION_NOT_EDITABLE', VERIFICATION_NOT_EDITABLE);
      }
      await withTransaction(prisma, async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "dealers" WHERE "id" = ${dealerId}::uuid FOR UPDATE`;
        const dealer = await tx.dealer.findUniqueOrThrow({
          where: { id: dealerId },
          select: { contactEmail: true },
        });
        if (!dealer.contactEmail) {
          throw new ConflictError('VERIFICATION_NO_EMAIL', VERIFICATION_NO_EMAIL);
        }
        const last = await tx.dealerEmailVerification.findFirst({
          where: { dealerId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        if (withinCooldown(last)) {
          throw new ConflictError('VERIFICATION_COOLDOWN', VERIFICATION_COOLDOWN);
        }
        await requestEmailVerification(tx, {
          dealerId,
          email: dealer.contactEmail,
          memberId,
          actorUserId: principal.userId,
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: principal.userId,
          dealerId,
          action: 'dealer.assisted.verification_resent',
          entityType: 'Dealer',
          entityId: dealerId,
          after: { assistedByMemberId: memberId },
        });
      });
      return detail(principal, dealerId);
    },

    async vehicles(principal: AdminPrincipal, dealerId: string): Promise<SalesVehiclesResponse> {
      const summary = await requireAssisted(principal, dealerId);
      const open = !CLOSED_FOR_LISTINGS.includes(summary.status);
      return {
        dealerApproved: summary.status === 'ACTIVE',
        canCreate: open,
        data: await vehicles.assistedList(assistedActor(principal, dealerId)),
      };
    },

    async createVehicle(principal: AdminPrincipal, dealerId: string, input: CreateVehicleInput) {
      await requireAssisted(principal, dealerId);
      const created = await vehicles.assistedCreate(assistedActor(principal, dealerId), input);
      logger.info(
        { event: 'sales.vehicle.created', adminMemberId: principal.memberId, dealerId },
        'assisted listing draft created',
      );
      return created;
    },

    async vehicle(principal: AdminPrincipal, dealerId: string, vehicleId: string) {
      await requireAssisted(principal, dealerId);
      return vehicles.assistedGet(assistedActor(principal, dealerId), vehicleId);
    },

    async updateVehicle(
      principal: AdminPrincipal,
      dealerId: string,
      vehicleId: string,
      input: UpdateVehicleInput,
    ) {
      await requireAssisted(principal, dealerId);
      return vehicles.assistedUpdate(assistedActor(principal, dealerId), vehicleId, input);
    },

    async submitVehicle(principal: AdminPrincipal, dealerId: string, vehicleId: string) {
      await requireAssisted(principal, dealerId);
      const submitted = await vehicles.assistedSubmit(
        assistedActor(principal, dealerId),
        vehicleId,
      );
      logger.info(
        {
          event: 'sales.vehicle.submitted',
          adminMemberId: principal.memberId,
          dealerId,
          vehicleId,
        },
        'assisted listing submitted for review',
      );
      return submitted;
    },

    async submit(principal: AdminPrincipal, dealerId: string) {
      await requireEditable(principal, dealerId);
      const result = await dealers.submitForVerification(dealerId, {
        type: 'ADMIN',
        id: principal.userId,
      });
      logger.info(
        { event: 'sales.dealer.submitted', adminMemberId: principal.memberId, dealerId },
        'assisted dealership submitted for verification',
      );
      return result;
    },
  };
}

export type SalesService = ReturnType<typeof createSalesService>;
