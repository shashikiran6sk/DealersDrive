import {
  DEALER_STATUS_LABELS,
  distinctServices,
  DOC_TYPE_LABELS,
  formatDate,
  formatPhone,
  normaliseLocality,
  PROFILE_CHANGE_STATUS_LABELS,
  toE164,
  type AuthSession,
  type CompletenessResponse,
  type DealerDocumentsResponse,
  type DealerSubmitResponse,
  type DealerProfile,
  type DealerProfileChange,
  type DealerSelfUpdateInput,
  type DocumentCommitInput,
  type DocumentPresignInput,
  type PresignResponse,
  type UpdateDealerInput,
  type YardPhotoCommitInput,
  type YardPhotoDto,
  type YardPhotoPresignInput,
} from '@dealers-drive/contracts';
import type { DealerDocType, PrismaClient } from '@prisma/client';

import { toMediaStatus } from '../media/media.facade.js';
import { randomUUID } from 'node:crypto';

import { getContext } from '../../middleware/request-context.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { mapKindFor, type MapsPort } from '../../platform/maps/maps-link.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { ConflictError, DomainError, NotFoundError } from '../../platform/errors.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import type { DealerPrincipal } from '../auth/auth.facade.js';
import { documentKey, yardPhotoKey } from './dealer-storage-keys.js';
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
 * `documents()` landed with **F040**. **F041** adds `toProfile`/`profile`,
 * `update`, and the three document write paths, and with them the first
 * dependency this service takes beyond its repository: `StoragePort`.
 *
 * F043 added `completeness()` and **F042** `submitForVerification()`, which
 * closes onboarding: every method the dealer-facing wizard calls is now here.
 * Still to come: `dashboard()` with **F048**, which brings
 * `EnquiriesRepository` and the `Listing` counters.
 * ────────────────────────────────────────────────────────────────────────────
 */
export interface DealersDeps {
  prisma: PrismaClient;
  repo: DealersRepository;
  storage: StoragePort;
  /** Where the yard is, out of the dealer's own Maps link. Best-effort. */
  maps: MapsPort;
  /**
   * R34. The dealer's own submission of a profile edit is audited, not only
   * the moderator's decision on it — "who typed this" is the first question
   * asked about a phone number that reached a public page, and a trail that
   * records only the approval cannot answer it.
   *
   * This is the first thing in this service to need the audit port, and it is
   * the right first thing: every other write here is a dealer editing fields
   * that are theirs outright.
   */
  audit: AuditService;
}

/**
 * The closed set. Three documents, always, in this order — the checklist is
 * fixed rather than data-driven, because "which documents does KYC need" is a
 * regulatory answer and not a per-dealer one.
 */
const DOC_TYPES: DealerDocType[] = ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'];

/**
 * How long a yard-photo read URL is good for.
 *
 * The same five minutes a KYC document gets. The image is destined to be
 * public, but it is not public *yet* — a dealership in DRAFT has not been
 * looked at by anybody, and until it has, its photographs are as private as
 * the rest of the application.
 */
const YARD_PHOTO_URL_TTL_SECONDS = 300;

/**
 * Whether two service lists say the same thing (**R34**).
 *
 * Order-insensitive and after `distinctServices`, because neither the order a
 * dealer typed their services in nor a repeat they typed twice is a change
 * anybody should be asked to approve. Without this, re-saving the profile
 * screen without touching the box would put a request in front of a moderator
 * asking them to agree that nothing had happened — the box is one
 * comma-separated line, so a dealer editing their tagline re-submits the
 * services every time.
 *
 * A `Set` on both sides rather than a sorted join: the values are already
 * de-duplicated, so equal sizes plus containment is the whole of it.
 */
function sameServices(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const held = new Set(b);
  return a.every((value) => held.has(value));
}

export function createDealersService({ prisma, repo, storage, maps, audit }: DealersDeps) {
  function toProfile(dealer: DealerWithRelations): DealerProfile {
    const owner = dealer.members.find((member) => member.role === 'OWNER');

    return {
      id: dealer.id,
      slug: dealer.slug,
      status: dealer.status,
      statusLabel: dealer.status === 'ACTIVE' ? 'Verified' : DEALER_STATUS_LABELS[dealer.status],
      statusReason: dealer.statusReason,
      brandName: dealer.brandName,
      legalName: dealer.legalName,
      tagline: dealer.tagline,
      gstin: dealer.gstin,
      pan: dealer.pan,
      contact: {
        fullName: owner?.user.fullName ?? null,
        phone: dealer.contactPhone ?? owner?.user.phone ?? '',
        phoneDisplay: formatPhone(dealer.contactPhone ?? owner?.user.phone ?? ''),
        email: owner?.user.email ?? dealer.contactEmail,
        landline: dealer.landline,
      },
      address: {
        line: dealer.addressLine,
        city: dealer.city,
        district: dealer.district,
        state: dealer.state,
        pincode: dealer.pincode,
        mapsUrl: dealer.mapsUrl,
        /*
         * What that link draws (**R20**). Composed here rather than in the form
         * for the reason `embedUrl` is composed for the portfolio: which of the
         * three answers a link produces is a question about the stored value,
         * and the form would have to re-parse the URL to ask it — in a second
         * implementation, in another package, that could disagree.
         */
        mapKind: mapKindFor({
          mapsUrl: dealer.mapsUrl,
          placeId: dealer.mapsPlaceId,
          coordinates:
            dealer.lat === null || dealer.lng === null
              ? null
              : { lat: dealer.lat, lng: dealer.lng },
        }),
      },
      specialities: dealer.specialities,
      workingHours: dealer.workingHours as Record<string, string | null> | null,
      establishedYear: dealer.establishedYear,
      logoMediaId: dealer.logoMediaId,
      coverMediaId: dealer.coverMediaId,
      creditBalance: dealer.creditBalance,
      creditsHeld: dealer.creditsHeld,
      activeListings: dealer.activeListings,
      approvedAt: dealer.approvedAt?.toISOString() ?? null,
      createdAt: dealer.createdAt.toISOString(),
      profileChange: toProfileChange(dealer.profileEdits[0]),
    };
  }

  /**
   * The newest proposed edit, if it still has something to say (**R34**).
   *
   * `null` for an APPROVED one, and that is the interesting case. Its values
   * are the ones on the profile beside it — the approval wrote them — so a
   * banner reporting it would be telling a dealer that the line they can see is
   * the line they asked for. The two states worth a word are PENDING, which
   * explains why the page still shows the old text, and REJECTED, which is the
   * only place a dealer ever learns why.
   */
  function toProfileChange(
    row: DealerWithRelations['profileEdits'][number] | undefined,
  ): DealerProfileChange | null {
    if (!row || row.status === 'APPROVED') return null;

    return {
      id: row.id,
      status: row.status,
      statusLabel: PROFILE_CHANGE_STATUS_LABELS[row.status],
      tagline: row.tagline,
      specialities: row.specialities,
      submittedAtLabel: formatDate(row.createdAt),
      reviewedAtLabel: row.reviewedAt ? formatDate(row.reviewedAt) : null,
      decisionReason: row.decisionReason,
    };
  }

  async function requireDealer(dealerId: string): Promise<DealerWithRelations> {
    const dealer = await repo.findById(dealerId);
    if (!dealer) throw new NotFoundError('That dealership no longer exists.');
    return dealer;
  }

  /**
   * The dealership's storage identity.
   *
   * Every object a dealership owns lives under `dealers/{slug}/`, and the key
   * of a KYC document is derived rather than stored — so each of the three
   * document paths has to know the slug before it can name a file. One narrow
   * read, rather than `requireDealer`'s full include, because the slug is the
   * only thing any of them wants.
   */
  async function requireSlug(dealerId: string): Promise<string> {
    const slug = await repo.slugById(dealerId);
    if (!slug) throw new NotFoundError('That dealership no longer exists.');
    return slug;
  }

  /**
   * Two dealerships in one city must not share a registered name, and no two
   * anywhere may share a GSTIN or a PAN.
   *
   * The unique indexes on `(legalName, city)`, `gstin` and `pan` are what
   * actually guarantee it, and they are what makes this safe against two
   * applications racing. This read exists for the other half of the job:
   * turning a collision into a message against the field the dealer just
   * typed, rather than a Prisma P2002 the error handler renders as a 500.
   *
   * The name is always asked about together with a city — the one being moved
   * to, or the one the dealership is already in — because a name on its own
   * cannot be a duplicate of anything.
   *
   * **PAN joined GSTIN at R38.** The asymmetry before it was not a decision:
   * both are read off a document by the same moderator on the same screen, and
   * both identify one taxable entity. Two dealerships holding one PAN is
   * either one business applying twice or a typo that has carried somebody
   * else's tax identity into a KYC review.
   */
  async function assertNoDuplicate(
    dealerId: string,
    fields: { legalName?: string; city?: string; gstin?: string; pan?: string },
  ): Promise<void> {
    const clash = await repo.findConflicting(dealerId, fields);

    // `clash.legalName` is only ever true when both were asked about, so the
    // message can name them without a fallback that would never be reached.
    if (clash.legalName) {
      throw new ConflictError(
        'DEALER_NAME_TAKEN',
        `A dealership called ${String(fields.legalName)} is already registered in ${String(fields.city)}.`,
        {
          errors: [
            {
              field: 'body.legalName',
              code: 'DEALER_NAME_TAKEN',
              message: `Already registered in ${String(fields.city)}.`,
            },
          ],
        },
      );
    }

    if (clash.gstin) {
      throw new ConflictError(
        'GSTIN_ALREADY_REGISTERED',
        'That GSTIN is already registered to another dealership.',
        {
          errors: [
            {
              field: 'body.gstin',
              code: 'GSTIN_ALREADY_REGISTERED',
              message: 'Already registered.',
            },
          ],
        },
      );
    }

    /*
     * GSTIN first, then PAN, when a step-3 submit carries both and both clash.
     * One field error at a time is the shape every other check on this path
     * uses, and GSTIN is the more specific of the two — a GSTIN embeds the PAN
     * of the entity that holds it, so a dealer who fixes the GSTIN usually
     * fixes the PAN with it. Reporting the derived field first would send them
     * to the wrong document.
     */
    if (clash.pan) {
      throw new ConflictError(
        'PAN_ALREADY_REGISTERED',
        'That PAN is already registered to another dealership.',
        {
          errors: [
            {
              field: 'body.pan',
              code: 'PAN_ALREADY_REGISTERED',
              message: 'Already registered.',
            },
          ],
        },
      );
    }
  }

  /** Remove the bytes, keep the row as ORPHAN so a sweeper can reconcile it. */
  async function discardMedia(mediaId: string): Promise<void> {
    const media = await repo.mediaById(mediaId);
    if (!media) return;
    await repo.orphanMedia(mediaId);
    await storage.delete(media.storageKey);
  }

  return {
    toProfile,
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

    async profile(dealerId: string): Promise<DealerProfile> {
      return toProfile(await requireDealer(dealerId));
    },

    /**
     * C2. Partial, so a wizard `Back` never loses data.
     *
     * `contact.phone` is patchable now, and the change is smaller than it
     * sounds: the number stopped being a credential when dealers started
     * signing in with Google, so what is being edited is the contact detail a
     * buyer is given. It is still unique across users — the check below is the
     * message; `users.phone`'s unique index is the guarantee.
     */
    /**
     * C2b — the same write, while the dealership is still a DRAFT (**R27**).
     *
     * `update` above takes `UpdateDealerInput` and always has; what changed in
     * R27 is who may hand it one. `PATCH /v1/dealer` now validates against
     * `DealerSelfUpdateInput` — three fields — so the onboarding wizard, which
     * walks back to the steps that ask for the name and the address, needed a
     * door of its own.
     *
     * The guard is the status and nothing else. A DRAFT dealership is one still
     * answering these questions, or one a moderator has sent back to fix an
     * answer: `Request changes` writes `status: 'DRAFT'` with a reason, which is
     * what makes this the same door in both cases. Nothing has been verified
     * about a DRAFT, so there is nothing an edit here can invalidate.
     *
     * `PROFILE_LOCKED` rather than a 403: the seat is allowed to write — it
     * holds `dealer:update` and it just wrote the tagline — and what is refused
     * is the *state*, which is what a 409 says. A dealer never sees this
     * message; the profile screen does not offer the boxes and the wizard is
     * only reachable while DRAFT. It is here for the client that goes looking.
     */
    async amendDraft(dealerId: string, input: UpdateDealerInput): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId);
      if (dealer.status !== 'DRAFT') {
        throw new ConflictError(
          'PROFILE_LOCKED',
          'This dealership has been submitted for verification, so its name, address and contact details can no longer be edited here.',
        );
      }

      return this.update(dealerId, input);
    },

    /**
     * C2 — the dealership editing itself, after onboarding is over, with the
     * two public sentences held for review (**R34**).
     *
     * ## Why this is not just `update`
     *
     * Three fields reach this method and they do not all mean the same thing.
     * `establishedYear` is a fact bounded by 1900 and the current year:
     * there is no way to write a phone number, a rival's name or a WhatsApp
     * handle into an integer, so it is published the moment the dealer saves
     * it. The tagline and the service list are the only prose a dealer writes
     * that a buyer reads — which makes them the only place a number can reach
     * a public page without passing `POST /v1/vehicles/:id/reveal-contact`, the
     * one route allowed to hand one out, rate-limited twice over and logged as
     * a lead (rule 7).
     *
     * Every other field on the profile screen has been read-only since **R27**
     * for the same family of reasons. These two were left editable because a
     * dealership is genuinely entitled to revise how it describes itself, and
     * both facts are true at once. A queue is what reconciles them: the dealer
     * keeps the pen, and nothing they write is public until somebody has read
     * it.
     *
     * ## What a DRAFT skips, and why that is not a hole
     *
     * A dealership that is not ACTIVE writes straight through. Nothing about it
     * is public — the directory and the portfolio both require
     * `status === 'ACTIVE'` (rule 6) — so there is no page for a phone number
     * to appear on, and the whole application is read by a moderator at
     * approval anyway. Queueing an edit to an invisible field would put a
     * dealership in the odd position of waiting for permission to finish an
     * application nobody has started reviewing.
     *
     * ## One request at a time, and the boxes are shut while it waits
     *
     * A dealership has at most one proposal outstanding, and a second edit to
     * either sentence while one is waiting is a **409** rather than a merge.
     * The profile screen does not offer the boxes at all in that state — they
     * are `disabled` and show the proposed text — so this refusal is the
     * server-side half of a rule the form already states, in the same shape
     * R27 used for the locked fields: the form is why a dealer never sends
     * one, and this is why it would not be written if they did.
     *
     * Merging them instead was the first design and it was worse in a way that
     * only shows up from the moderator's side. A request that quietly absorbs
     * later edits is a request whose text can change *after* somebody has
     * started reading it — the queue row a moderator opened and the row they
     * approve are then not the same words, and nothing tells them so.
     *
     * ## Withdrawing is a button, not a coincidence
     *
     * `withdrawProfileChange` below deletes the waiting request. There is no
     * inference from what the dealer typed: an edit that happens to restore the
     * live value is still an edit, and reading it as a cancellation makes the
     * cancel path something a dealer has to discover rather than press.
     *
     * What survives from that idea is much narrower and is not a withdrawal —
     * `changed()` below asks whether a save *proposes anything at all*. The
     * form submits all three fields on every save, so a dealer correcting only
     * their established year re-sends the tagline and the service list
     * unchanged, and without that check every such save would put a request in
     * front of a moderator asking them to approve the status quo.
     */
    async selfUpdate(
      dealerId: string,
      actorUserId: string | null,
      input: DealerSelfUpdateInput,
    ): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId);

      if (dealer.status !== 'ACTIVE') return this.update(dealerId, input);

      // The year is a fact, not a sentence, so it goes straight in. Doing it
      // first means a save carrying all three fields still lands the half that
      // needs no review, rather than making the year wait behind the prose.
      if (input.establishedYear !== undefined) {
        await this.update(dealerId, { establishedYear: input.establishedYear });
      }

      /*
       * What this save actually proposes.
       *
       * `undefined` is a field the save did not carry; a value equal to what is
       * already live proposes nothing. The second half is not a withdrawal —
       * see the note above — it is the answer to "is there anything here to
       * review", asked because the form re-sends all three fields every time.
       */
      const tagline =
        input.tagline === undefined || input.tagline === dealer.tagline ? null : input.tagline;

      const typedServices =
        input.specialities === undefined ? null : distinctServices(input.specialities);
      const specialities =
        typedServices === null || sameServices(typedServices, dealer.specialities)
          ? []
          : typedServices;

      if (tagline === null && specialities.length === 0) {
        return toProfile(await requireDealer(dealerId));
      }

      /*
       * One at a time. The boxes are shut on the profile screen while a request
       * waits, so reaching here means a client went around the form — and a
       * 409 rather than a 403 because the seat is allowed to write and it is
       * the *state* that refuses, which is the same reading `amendDraft` gives
       * `PROFILE_LOCKED`.
       */
      const pending = dealer.profileEdits.find((row) => row.status === 'PENDING');
      if (pending) {
        throw new ConflictError(
          'PROFILE_EDIT_PENDING',
          'You already have a change waiting for review. Cancel it first if you want to write something different.',
        );
      }

      await withTransaction(prisma, async (tx) => {
        const saved = await tx.dealerProfileChange.create({
          data: { dealerId, tagline, specialities, submittedBy: actorUserId },
        });

        /*
         * The dealer's own submission is audited as well as the decision on it.
         *
         * Without this the audit trail can say a moderator approved a tagline
         * and cannot say who wrote it — and "who typed this" is the first
         * question asked about a phone number that reached a public page.
         */
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actorUserId,
          dealerId,
          action: 'dealer.profile_change.submitted',
          entityType: 'DealerProfileChange',
          entityId: saved.id,
          before: { tagline: dealer.tagline, specialities: dealer.specialities },
          after: { tagline, specialities },
        });

        /*
         * **R40.** A queue nobody is told about is a queue nobody works, and
         * R34 shipped the request without one — a dealership's proposal sat
         * waiting until a moderator happened to open the console.
         *
         * In the transaction, like every other outbox write on this path: the
         * email is then exactly as durable as the request it is about, and a
         * rollback cannot leave a moderator reading about a change that does
         * not exist.
         */
        await enqueueOutbox(tx, {
          type: 'DealerProfileChangeSubmitted',
          aggregateType: 'DealerProfileChange',
          aggregateId: saved.id,
          dealerId,
          // `actorUserId` is nullable on this path — an admin editing on a
          // dealer's behalf has no dealer seat — and `actor.id` is optional
          // rather than nullable, so the key is dropped instead of nulled.
          actor: { type: 'DEALER', ...(actorUserId === null ? {} : { id: actorUserId }) },
          traceId: getContext()?.traceId ?? 'profile-change-submitted',
          payload: { dealerId, profileChangeId: saved.id },
        });
      });

      return toProfile(await requireDealer(dealerId));
    },

    /**
     * The dealer taking their own proposal back (**R34**).
     *
     * A button rather than an inference. The first design read "the dealer
     * retyped the live value" as a cancellation, which made the way out
     * something to be discovered rather than pressed — and was wrong on its own
     * terms besides, since an edit that happens to restore the live text is
     * still an edit.
     *
     * The row is **deleted**, not marked withdrawn. A record that a dealership
     * briefly considered a different tagline is not history anybody reads, and
     * a WITHDRAWN row would sit in the `[dealerId, createdAt]` read this
     * service makes on every profile render, having to be filtered out
     * everywhere for the sake of nothing.
     *
     * Nothing waiting is a 404. The button only renders when there is one, so
     * reaching this with nothing to cancel is a double-click or a stale page —
     * both of which want the screen re-read, which is what a 404 gets them.
     */
    async withdrawProfileChange(
      dealerId: string,
      actorUserId: string | null,
    ): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId);
      const pending = dealer.profileEdits.find((row) => row.status === 'PENDING');
      if (!pending) {
        throw new NotFoundError('You have no change waiting for review.');
      }

      await withTransaction(prisma, async (tx) => {
        await tx.dealerProfileChange.delete({ where: { id: pending.id } });

        // Audited even though the row is gone: `entityId` outlives it, and
        // "what happened to the edit I was reviewing" is a question a moderator
        // will ask about a queue row that vanished under them.
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actorUserId,
          dealerId,
          action: 'dealer.profile_change.withdrawn',
          entityType: 'DealerProfileChange',
          entityId: pending.id,
          before: { tagline: pending.tagline, specialities: pending.specialities },
          after: null,
        });
      });

      return toProfile(await requireDealer(dealerId));
    },

    async update(dealerId: string, input: UpdateDealerInput): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId);
      const owner = dealer.members.find((member) => member.role === 'OWNER');

      /**
       * Locality as text, normalised once here.
       *
       * A slug resolved against `cities` until the table went; the note on
       * `UpdateDealerInput.address` in contracts records why. `lat`/`lng` came
       * off that row and are written again below — out of the dealer's own
       * Maps link, never out of the typed address.
       */
      const city =
        input.address?.city === undefined ? undefined : normaliseLocality(input.address.city);
      const district =
        input.address?.district === undefined
          ? undefined
          : normaliseLocality(input.address.district);
      const state =
        input.address?.state === undefined ? undefined : normaliseLocality(input.address.state);

      /**
       * The services, collapsed to a set (**R18**).
       *
       * Here rather than in the schema, for the reason the localities are here:
       * this is a normalisation, not a refusal. A dealer who types "Finance,
       * finance" has made a slip, and the useful answer is one service rather
       * than a 400 explaining that they typed a word twice. A transform in the
       * input schema would also have to survive `z.toJSONSchema`, and a
       * transform cannot be represented in JSON Schema at all.
       *
       * The 12-item cap in `UpdateDealerInput` is therefore over what was
       * *typed*, not over what is kept. Thirteen entries with a duplicate among
       * them is still a 400 — a rarer accident than the one this fixes, and
       * moving the cap after the collapse would take `maxItems` out of the
       * reference.
       */
      const specialities =
        input.specialities === undefined ? undefined : distinctServices(input.specialities);

      /**
       * The contact number, in the one form the column stores.
       *
       * `toE164` runs here rather than at the edge for the same reason
       * `normaliseLocality` does: the uniqueness constraint is an index over
       * the stored string, so `98400 12345` and `+919840012345` have to become
       * one value *before* anything compares them.
       */
      const phone = input.contact?.phone === undefined ? undefined : toE164(input.contact.phone);

      /**
       * The pin, and the place it names, re-read whenever the link changes.
       *
       * Only when it *changes*: a dealer editing their opening hours should not
       * pay a request to Google for it, and a link that resolved once resolves
       * to the same place. `null` when the link cannot be resolved — which
       * clears a stale pin rather than leaving the previous yard's coordinates
       * attached to a dealership that has moved.
       *
       * This is the one place a network call sits on a dealer's save, and it is
       * bounded and best-effort: `resolveCoordinates` swallows a timeout and
       * answers null, the "Get directions" anchor is `mapsUrl` either way, and
       * the location card falls back to the slot it showed before.
       */
      const mapsUrl = input.address?.mapsUrl;
      const place =
        mapsUrl === undefined || mapsUrl === dealer.mapsUrl
          ? undefined
          : await maps.placeFor(mapsUrl);

      if (phone !== undefined && owner) {
        const holder = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
        if (holder && holder.id !== owner.userId) {
          throw new ConflictError(
            'PHONE_ALREADY_REGISTERED',
            'That mobile number is already registered to another dealership.',
            {
              errors: [
                {
                  // Named as the client sent it, so the form can mark the box
                  // the dealer typed into. `apps/web` maps the leaf to `phone`.
                  field: 'body.contact.phone',
                  code: 'PHONE_ALREADY_REGISTERED',
                  message: 'Already registered.',
                },
              ],
            },
          );
        }
      }

      /**
       * A rename is checked against the city it will be in once this PATCH
       * lands, which is not always the city the dealership is in now: a dealer
       * changing both fields in one submit must be checked against the pair
       * they typed, not against a half-applied combination of the two.
       */
      const nameCity = city ?? dealer.city ?? undefined;
      await assertNoDuplicate(dealerId, {
        ...(input.legalName === undefined || nameCity === undefined
          ? {}
          : { legalName: input.legalName, city: nameCity }),
        ...(input.gstin === undefined ? {} : { gstin: input.gstin }),
        ...(input.pan === undefined ? {} : { pan: input.pan }),
      });

      const updated = await withTransaction(prisma, async (tx) => {
        if (input.contact && owner) {
          await tx.user.update({
            where: { id: owner.userId },
            data: {
              ...(input.contact.fullName === undefined ? {} : { fullName: input.contact.fullName }),
              ...(input.contact.email === undefined ? {} : { email: input.contact.email }),
              ...(phone === undefined ? {} : { phone }),
            },
          });
        }

        return repo.update(
          dealerId,
          {
            // One name. `brandName` is the display mirror and is written here
            // rather than accepted from the client, which is why
            // `UpdateDealerInput` does not carry it.
            ...(input.legalName === undefined
              ? {}
              : { legalName: input.legalName, brandName: input.legalName }),
            ...(input.tagline === undefined ? {} : { tagline: input.tagline }),
            ...(input.gstin === undefined ? {} : { gstin: input.gstin }),
            ...(input.pan === undefined ? {} : { pan: input.pan }),
            ...(input.establishedYear === undefined
              ? {}
              : { establishedYear: input.establishedYear }),
            ...(specialities === undefined ? {} : { specialities }),
            ...(input.workingHours === undefined ? {} : { workingHours: input.workingHours }),
            ...(input.contact?.email === undefined ? {} : { contactEmail: input.contact.email }),
            // Two columns, one number: `users.phone` is who the dealer is to us
            // and `dealers.contactPhone` is what a buyer is shown. Onboarding
            // writes both from one answer, so an edit has to as well — leaving
            // the mirror stale would publish the old number.
            ...(phone === undefined ? {} : { contactPhone: phone }),
            ...(input.contact?.landline === undefined ? {} : { landline: input.contact.landline }),
            ...(input.address?.line === undefined ? {} : { addressLine: input.address.line }),
            ...(city === undefined ? {} : { city }),
            ...(district === undefined ? {} : { district }),
            ...(state === undefined ? {} : { state }),
            ...(input.address?.pincode === undefined ? {} : { pincode: input.address.pincode }),
            ...(mapsUrl === undefined ? {} : { mapsUrl }),
            ...(place === undefined
              ? {}
              : {
                  lat: place.coordinates?.lat ?? null,
                  lng: place.coordinates?.lng ?? null,
                  mapsPlaceId: place.placeId,
                }),
          },
          tx,
        );
      });

      return toProfile(updated);
    },

    /** C3. Drives the onboarding stepper and gates `POST /v1/dealer/submit`. */
    async completeness(dealerId: string): Promise<CompletenessResponse> {
      const dealer = await requireDealer(dealerId);
      const owner = dealer.members.find((member) => member.role === 'OWNER');
      const documents = await repo.documents(dealerId);

      const accountMissing: string[] = [];
      if (!owner?.user.fullName) accountMissing.push('fullName');
      if (!owner?.user.email) accountMissing.push('email');

      const businessMissing: string[] = [];
      if (!dealer.legalName) businessMissing.push('legalName');
      if (!dealer.addressLine) businessMissing.push('addressLine');
      if (!dealer.city) businessMissing.push('city');
      /*
       * The district joins the required set rather than sitting beside it as a
       * nice-to-have. It is asked for on the same step as the city, it is what
       * the admin console filters on, and a filter that silently omits the
       * dealerships that skipped the question is a filter that lies. Rows
       * created before the column existed read as incomplete here, which is
       * true: they are, and the profile screen is where that is fixed.
       */
      if (!dealer.district) businessMissing.push('district');
      if (!dealer.state) businessMissing.push('state');
      if (!dealer.pincode) businessMissing.push('pincode');
      /*
       * The directions link, named for the same reason the yard photograph is:
       * the public portfolio is "here is the yard, here is how to reach it",
       * and half of that missing is a page that quietly does less. Dealerships
       * created before the question was asked read as incomplete here, which is
       * true of them — the Business step is where it is fixed.
       */
      if (!dealer.mapsUrl) businessMissing.push('mapsUrl');
      /*
       * The line and the services, required on the same footing as the address
       * and the link (**R26**). The public portfolio is the page a dealership
       * is judged on before anybody drives anywhere, and one with a photograph,
       * a pin and no sentence reads as an unfinished listing rather than a
       * business.
       *
       * These two replaced `about`, which asked for the same thing at forty
       * times the length and got either a paragraph nobody read or twenty
       * characters of "we sell used cars". A dealership that had written one
       * but no tagline reads as incomplete here, which is correct — and moot
       * since **R33**, which dropped the column: whatever they wrote is not a
       * line under their name, and there is nothing left to read it out of.
       *
       * Dealerships created before either was asked read as incomplete here.
       * That is true of them, and the Business step is where it is fixed.
       * There is no backfill for the same reason there is none for `mapsUrl`:
       * nobody but the dealer can write this sentence.
       */
      if (!dealer.tagline) businessMissing.push('tagline');
      if (dealer.specialities.length === 0) businessMissing.push('specialities');
      if (!dealer.gstin) businessMissing.push('gstin');
      if (!dealer.pan) businessMissing.push('pan');

      const documentsMissing: string[] = DOC_TYPES.filter((type) => {
        const doc = documents.find((row) => row.type === type);
        return !doc || doc.status === 'REQUIRED' || doc.status === 'REJECTED';
      });

      // The yard photograph sits on the documents step because that is the
      // step where a dealer uploads things — but it is required for a
      // different reason. It is the hero of the public portfolio, and a
      // dealership whose storefront would open with an empty frame is not
      // ready to be reviewed.
      if (!dealer.coverMediaId) documentsMissing.push('YARD_PHOTO');

      const steps: CompletenessResponse['steps'] = [
        {
          key: 'account',
          label: 'Account',
          complete: accountMissing.length === 0,
          missing: accountMissing,
        },
        {
          key: 'business',
          label: 'Business',
          complete: businessMissing.length === 0,
          missing: businessMissing,
        },
        {
          key: 'documents',
          label: 'Documents',
          complete: documentsMissing.length === 0,
          missing: documentsMissing,
        },
        {
          key: 'review',
          label: 'Review',
          complete: dealer.status !== 'DRAFT',
          missing: [],
        },
      ];

      const done = steps.filter((step) => step.complete).length;
      const isComplete = steps.slice(0, 3).every((step) => step.complete);

      return {
        isComplete,
        canSubmit: isComplete && dealer.status === 'DRAFT',
        percent: Math.round((done / steps.length) * 100),
        steps,
      };
    },

    /** C4. DRAFT → PENDING_APPROVAL. No body; the state machine decides. */
    async submitForVerification(dealerId: string): Promise<DealerSubmitResponse> {
      const dealer = await requireDealer(dealerId);
      if (dealer.status !== 'DRAFT') {
        throw new DomainError(
          'ALREADY_SUBMITTED',
          'This dealership has already been submitted for verification.',
        );
      }

      const state = await this.completeness(dealerId);
      if (!state.isComplete) {
        throw new DomainError('PROFILE_INCOMPLETE', 'Some details are still missing.', {
          errors: state.steps.flatMap((step) =>
            step.missing.map((field) => ({
              field,
              code: 'REQUIRED',
              message: `${field} is required.`,
            })),
          ),
        });
      }

      const submittedAt = new Date();
      await withTransaction(prisma, async (tx) => {
        /*
         * `statusReason` is cleared on the way back into the queue.
         *
         * It is set when an admin sends an application back for changes, and
         * the onboarding screen reads it two ways: as the banner explaining
         * what to fix, and — since it is the only mark distinguishing a
         * returned application from one that was never finished — as the signal
         * to reopen at step one. Leaving it behind would show the dealer a
         * complaint they have already answered.
         */
        await repo.update(dealerId, { status: 'PENDING_APPROVAL', statusReason: null }, tx);
        await enqueueOutbox(tx, {
          type: 'DealerApplied',
          aggregateType: 'Dealer',
          aggregateId: dealerId,
          dealerId,
          actor: { type: 'DEALER' },
          traceId: getContext()?.traceId ?? 'dealer-submit',
          payload: { dealerId },
        });
      });

      return {
        status: 'PENDING_APPROVAL',
        statusLabel: 'Under review',
        submittedAt: submittedAt.toISOString(),
        expectedDecisionBy: new Date(submittedAt.getTime() + 86_400_000).toISOString(),
        message:
          'We verify GSTIN, PAN and address proof against government records. Most dealerships are approved within one working day.',
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

    /**
     * Documents go through the same presign → PUT → commit pipeline as photos,
     * with three differences: a private prefix, **no public delivery route**,
     * and no derivatives. The promise that buyers never see them is enforced by
     * there being no route that could serve them, not by a flag (§26.6).
     */
    async presignDocument(dealerId: string, input: DocumentPresignInput): Promise<PresignResponse> {
      const slug = await requireSlug(dealerId);
      const documentId = randomUUID();
      const key = documentKey(slug, input.type, documentId);

      /**
       * Replacing removes what was there.
       *
       * The row is about to be overwritten with a new id, and the stored
       * object's key ends in the old one — so this is the last moment anything
       * knows where the previous file is. Skip it and every replacement leaves
       * a KYC document sitting in storage that nothing references and nothing
       * will ever delete, which for scans of PAN cards is a retention problem
       * rather than a housekeeping one.
       */
      const previous = await repo.documentByType(dealerId, input.type);
      if (previous) await storage.delete(documentKey(slug, input.type, previous.id));

      await repo.upsertDocument(dealerId, input.type, {
        id: documentId,
        status: 'UPLOADING',
        fileName: input.fileName,
        mediaId: null,
        rejectionReason: null,
      });

      const presigned = await storage.presignPut({
        key,
        contentType: input.mimeType,
        contentLength: input.bytes,
      });

      return {
        documentId,
        uploadUrl: presigned.uploadUrl,
        method: 'PUT',
        headers: presigned.headers,
        expiresInSeconds: presigned.expiresInSeconds,
      };
    },

    async commitDocument(dealerId: string, type: DealerDocType, input: DocumentCommitInput) {
      const doc = await repo.documentById(input.documentId);
      if (!doc || doc.dealerId !== dealerId || doc.type !== type) {
        throw new NotFoundError('That document does not exist.');
      }

      const object = await storage.head(
        documentKey(await requireSlug(dealerId), type, input.documentId),
      );
      if (!object) {
        throw new DomainError('UPLOAD_MISSING', 'The upload did not complete. Try again.');
      }

      await repo.upsertDocument(dealerId, type, { status: 'UPLOADED', mediaId: null });
      const response = await this.documents(dealerId);
      return response.data.find((row) => row.type === type);
    },

    /**
     * C5 delete. The row survives as `REQUIRED` — the checklist has three rows
     * whatever happens to them — but the bytes do not.
     *
     * The row is read before it is reset, because the stored object's key ends
     * in the row's id. The baseline deleted `kyc/{dealerId}/{type}`, which is
     * the *prefix* the object lives under rather than the object itself, so
     * every removed document stayed in storage. That is fixed here.
     */
    async deleteDocument(dealerId: string, type: DealerDocType): Promise<void> {
      const slug = await requireSlug(dealerId);
      const existing = await repo.documentByType(dealerId, type);
      if (!existing) throw new NotFoundError('That document does not exist.');

      await repo.deleteDocument(dealerId, type);
      await storage.delete(documentKey(slug, type, existing.id));
    },

    // ─────────── The yard photograph ──────────────────────────────────────

    /**
     * The image that will front this dealership's public portfolio.
     *
     * It is deliberately not a fourth `DealerDocType`. The three KYC documents
     * are private, have no public delivery route and exist to be read once by a
     * moderator; this one is the first thing a buyer will ever see. Sharing the
     * pipeline is fine — sharing the checklist would mean sharing the privacy
     * rules, and those are the part that must not be got wrong.
     *
     * It lands on `dealer.coverMediaId`, because a hero image of the premises
     * is exactly what that slot is for.
     */
    async yardPhoto(dealerId: string): Promise<YardPhotoDto> {
      const dealer = await requireDealer(dealerId);
      if (!dealer.coverMediaId) {
        return { mediaId: null, status: null, fileName: null, url: null, uploadedAt: null };
      }

      const media = await repo.mediaById(dealer.coverMediaId);
      if (!media) {
        return { mediaId: null, status: null, fileName: null, url: null, uploadedAt: null };
      }

      return {
        mediaId: media.id,
        status: toMediaStatus(media.status),
        fileName: media.fileName,
        /*
         * A signed read of the original, not a delivery URL.
         *
         * The derivative pipeline that content-addresses an image and gives it
         * a permanent public URL is **F034**. Until it exists the original is
         * the only copy there is, and signing a read of it is the only honest
         * way to show a dealer what they uploaded. When F034 lands this becomes
         * `mediaUrl(media.id, …)` for a READY row and the row stops being
         * PENDING; nothing else about this path changes.
         */
        url: await storage.signedReadUrl(media.storageKey, YARD_PHOTO_URL_TTL_SECONDS),
        uploadedAt: media.createdAt.toISOString(),
      };
    },

    async presignYardPhoto(
      dealerId: string,
      input: YardPhotoPresignInput,
    ): Promise<PresignResponse> {
      const dealer = await requireDealer(dealerId);

      const mediaId = randomUUID();
      const key = yardPhotoKey(dealer.slug, mediaId);

      await repo.createMedia({
        id: mediaId,
        dealerId,
        ownerType: 'DEALER_COVER',
        storageKey: key,
        mimeType: input.mimeType,
        bytes: input.bytes,
        width: input.width ?? null,
        height: input.height ?? null,
        fileName: input.fileName,
        warnings: [],
        status: 'PENDING',
      });

      const presigned = await storage.presignPut({
        key,
        contentType: input.mimeType,
        contentLength: input.bytes,
      });

      return {
        mediaId,
        uploadUrl: presigned.uploadUrl,
        method: 'PUT',
        headers: presigned.headers,
        expiresInSeconds: presigned.expiresInSeconds,
        maxBytes: input.bytes,
      };
    },

    /**
     * Commit, and displace whatever was there.
     *
     * The delete happens *here* rather than at presign — the opposite of the
     * KYC path — because nothing is overwritten until this point. A presign
     * that is never followed by a `PUT` leaves the dealership's existing yard
     * photograph exactly where it was, which is what a dealer who changed their
     * mind halfway through picking a file expects.
     */
    async commitYardPhoto(dealerId: string, input: YardPhotoCommitInput): Promise<YardPhotoDto> {
      const dealer = await requireDealer(dealerId);

      const media = await repo.mediaById(input.mediaId);
      if (!media || media.dealerId !== dealerId || media.ownerType !== 'DEALER_COVER') {
        throw new NotFoundError('That upload does not exist.');
      }

      const object = await storage.head(media.storageKey);
      if (!object) {
        throw new DomainError('UPLOAD_MISSING', 'The upload did not complete. Try again.');
      }

      /*
       * READY, here, at commit.
       *
       * `media.serve()` refuses anything that is not READY, and the only thing
       * that promotes a row is **F034**'s derivative worker — which does not
       * exist, and whose `media.process` job nothing consumes. So every yard
       * photograph ever uploaded sat at PENDING, and the public pages had no
       * image to show even once the dealership was approved.
       *
       * Marking it here is not standing in for F034. The object has just been
       * HEADed, so the bytes are known to be there, and the presigned PUT
       * signed their content-type and length — which is what lets `serve()`
       * fall back to the original when a row has no variants yet. F034 adds
       * the re-encoded renditions and `serve()` prefers them the moment they
       * exist; nothing on this path changes when it lands.
       */
      const displaced = dealer.coverMediaId;
      await repo.markMediaReady(media.id);
      await repo.update(dealerId, { coverMediaId: media.id });
      if (displaced && displaced !== media.id) await discardMedia(displaced);

      return this.yardPhoto(dealerId);
    },

    async deleteYardPhoto(dealerId: string): Promise<void> {
      const dealer = await requireDealer(dealerId);
      if (!dealer.coverMediaId) throw new NotFoundError('There is no yard photograph to remove.');

      await repo.update(dealerId, { coverMediaId: null });
      await discardMedia(dealer.coverMediaId);
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
