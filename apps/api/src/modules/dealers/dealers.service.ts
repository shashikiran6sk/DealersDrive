import {
  DEALER_STATUS_LABELS,
  DOC_TYPE_LABELS,
  formatPhone,
  type AuthSession,
  type DealerDocumentsResponse,
} from '@dealers-drive/contracts';
import type { DealerDocType, PrismaClient } from '@prisma/client';

import { NotFoundError } from '../../platform/errors.js';
import type { DealerPrincipal } from '../auth/auth.facade.js';
import type { DealersRepository, DealerWithRelations } from './dealers.repository.js';

/**
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is 610 lines and covers the profile, the onboarding
 * completeness tracker, the KYC document paths and the dealer dashboard. Each
 * of those belongs to a feature further down the list, and each brings a
 * dependency this one does not have: `StoragePort` for the document
 * presigning, `EnquiriesRepository` for the dashboard, `Vehicle` and `Listing`
 * for the counters.
 *
 * `session()` landed with **F018** — the one method the auth module calls, and
 * the reason `dealers.facade.ts` re-exports `DealersService` at all.
 * `documents()` lands with **F040**: it is a pure read over rows the repository
 * already returns, so it needs nothing this service does not already hold.
 *
 * Still to come: `toProfile`/`update` and the presign, commit and delete paths
 * with **F041**, `completeness()` with **F043**, `submitForVerification()` with
 * **F042**, and `dashboard()` with **F048**.
 * ────────────────────────────────────────────────────────────────────────────
 */
export interface DealersDeps {
  prisma: PrismaClient;
  repo: DealersRepository;
}

/**
 * The closed set. Three documents, always, in this order — the checklist is
 * fixed rather than data-driven, because "which documents does KYC need" is a
 * regulatory answer and not a per-dealer one.
 */
const DOC_TYPES: DealerDocType[] = ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'];

export function createDealersService({ repo }: DealersDeps) {
  async function requireDealer(dealerId: string): Promise<DealerWithRelations> {
    const dealer = await repo.findById(dealerId);
    if (!dealer) throw new NotFoundError('That dealership no longer exists.');
    return dealer;
  }

  return {
    /**
     * The dealer half of B4. `identity` is filled in by the auth module, which
     * owns the OAuth tables — this service knows about dealerships, not about
     * how the person at the keyboard proved who they are.
     */
    async session(principal: DealerPrincipal): Promise<AuthSession> {
      const dealer = await requireDealer(principal.dealerId);
      const owner = dealer.members.find((member) => member.userId === principal.userId);
      const [newEnquiries, pendingListings] = await Promise.all([
        repo.newEnquiryCount(dealer.id),
        repo.pendingListingCount(dealer.id),
      ]);

      const phone = owner?.user.phone ?? dealer.contactPhone ?? '';

      return {
        // A dealership still in DRAFT has not finished onboarding, whatever the
        // client remembers; PENDING_APPROVAL is waiting on a human at our end.
        next:
          dealer.status === 'DRAFT'
            ? 'ONBOARDING'
            : dealer.status === 'PENDING_APPROVAL'
              ? 'PENDING_APPROVAL'
              : 'DASHBOARD',
        identity: null,
        user: {
          id: principal.userId,
          fullName: owner?.user.fullName ?? null,
          roleTitle: owner?.user.roleTitle ?? null,
          phone,
          phoneDisplay: formatPhone(phone),
          email: owner?.user.email ?? null,
          emailVerified: owner?.user.emailVerifiedAt !== null,
        },
        dealer: {
          id: dealer.id,
          slug: dealer.slug,
          brandName: dealer.brandName,
          status: dealer.status,
          statusLabel:
            dealer.status === 'ACTIVE' ? 'Verified' : DEALER_STATUS_LABELS[dealer.status],
          isVerified: dealer.status === 'ACTIVE',
          creditBalance: dealer.creditBalance,
          creditsHeld: dealer.creditsHeld,
        },
        role: principal.role,
        permissions: [...principal.permissions],
        counts: { newEnquiries, pendingListings },
      };
    },

    // ─────────── C5 KYC documents ─────────────────────────────────────────

    /**
     * The checklist, as the onboarding step and the console both render it.
     *
     * Every one of the three types is returned whether or not a row exists for
     * it — a response that grew as documents were uploaded would leave a
     * missing document looking like one that was never required.
     */
    async documents(dealerId: string): Promise<DealerDocumentsResponse> {
      const rows = await repo.documents(dealerId);

      const data = DOC_TYPES.map((type) => {
        const doc = rows.find((row) => row.type === type);
        const status = doc?.status ?? 'REQUIRED';

        return {
          id: doc?.id ?? null,
          type,
          label: DOC_TYPE_LABELS[type],
          status,
          statusLabel: documentStatusLabel(
            status,
            doc?.fileName ?? null,
            doc?.rejectionReason ?? null,
          ),
          fileName: doc?.fileName ?? null,
          uploadedAt: doc?.createdAt.toISOString() ?? null,
          rejectionReason: doc?.rejectionReason ?? null,
          action:
            status === 'REQUIRED' || status === 'REJECTED'
              ? 'Upload'
              : status === 'UPLOADING'
                ? 'Cancel'
                : 'Replace',
        };
      });

      return { data, allVerified: data.every((doc) => doc.status === 'VERIFIED') };
    },
  };
}

export type DealersService = ReturnType<typeof createDealersService>;

/**
 * The sub-line under each row. It is a sentence a dealer can act on rather than
 * an enum name — `REJECTED` tells them nothing, "Too blurry to read" tells them
 * what to do next.
 */
function documentStatusLabel(
  status: string,
  fileName: string | null,
  rejectionReason: string | null,
): string {
  switch (status) {
    case 'UPLOADED':
      return `${fileName ?? 'File'} · uploaded`;
    case 'VERIFIED':
      return `${fileName ?? 'File'} · verified`;
    case 'UPLOADING':
      return 'Uploading…';
    case 'REJECTED':
      return rejectionReason ?? 'Rejected — please upload a clearer copy';
    default:
      return 'Required — PDF or JPG, max 5 MB';
  }
}
