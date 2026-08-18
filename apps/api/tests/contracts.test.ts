import {
  AdminDealersResponse,
  ApproveListingResponse,
  BillingSummary,
  CatalogBundle,
  CitiesResponse,
  CreateOrderResponse,
  CreditPacksResponse,
  DashboardResponse,
  DealerDirectoryResponse,
  DealerDocumentsResponse,
  DealerProfile,
  DealerPublicProfile,
  DealerVehicleDto,
  DealerVehiclesResponse,
  EnquiryCountsResponse,
  EnquiryCreatedResponse,
  EnquiryListResponse,
  FacetsResponse,
  HomeResponse,
  InventoryResponse,
  InvoicesResponse,
  LedgerResponse,
  ModerationQueueResponse,
  PublicConfig,
  RevealContactResponse,
  SessionResponse,
  SubmitListingResponse,
  VehicleBatchResponse,
  VehicleDetail,
  VehicleListResponse,
  VerifyOrderResponse,
} from '@dealers-drive/contracts';
import type { ZodType } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSubmittableVehicle, ensureCredits } from './fixtures.js';
import { createHarness, DEALER_A, type Harness } from './harness.js';

/**
 * CLAUDE.md §26 — "API contracts: responses satisfy `packages/contracts`".
 *
 * `packages/contracts` is the shared schema the web app parses with, so a field
 * the API renames or drops breaks a page rather than a type-check. Parsing every
 * response through the same schema here turns that into a failing test.
 *
 * `parse` is used rather than `safeParse` on purpose: the thrown ZodError names
 * the offending path, which is the whole diagnostic.
 */
function conforms<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

describe('API responses satisfy the shared contracts', () => {
  let h: Harness;
  /** A live car, for the endpoints that need a real published listing. */
  let liveVehicleId: string;
  let liveSlug: string;

  beforeAll(async () => {
    h = await createHarness();
    h.actAs(DEALER_A);
    await ensureCredits(h, 2);

    const search = await h.agent().get(`/v1/vehicles?dealer=${DEALER_A}&limit=1`).expect(200);
    liveVehicleId = search.body.data[0].id;
    liveSlug = search.body.data[0].slug;
  });

  afterAll(async () => {
    await h.close();
  });

  describe('public', () => {
    it('GET /v1/catalog/bundle', async () => {
      conforms(CatalogBundle, (await h.agent().get('/v1/catalog/bundle').expect(200)).body);
    });

    it('GET /v1/cities', async () => {
      conforms(CitiesResponse, (await h.agent().get('/v1/cities').expect(200)).body);
    });

    it('GET /v1/config/public', async () => {
      conforms(PublicConfig, (await h.agent().get('/v1/config/public').expect(200)).body);
    });

    it('GET /v1/home', async () => {
      conforms(HomeResponse, (await h.agent().get('/v1/home').expect(200)).body);
    });

    it('GET /v1/vehicles', async () => {
      const unfiltered = await h.agent().get('/v1/vehicles?limit=12').expect(200);
      conforms(VehicleListResponse, unfiltered.body);

      // Filtered, sorted and paged, because `appliedFilters` and the empty-state
      // fields only appear on some of those paths.
      const filtered = await h
        .agent()
        .get('/v1/vehicles?fuel=petrol&sort=price_asc&page=1&limit=6')
        .expect(200);
      conforms(VehicleListResponse, filtered.body);

      const empty = await h
        .agent()
        .get('/v1/vehicles?priceMin=49000000&priceMax=50000000')
        .expect(200);
      conforms(VehicleListResponse, empty.body);
      expect(empty.body.data).toHaveLength(0);
    });

    it('GET /v1/vehicles/facets', async () => {
      conforms(FacetsResponse, (await h.agent().get('/v1/vehicles/facets').expect(200)).body);
    });

    it('POST /v1/vehicles/batch', async () => {
      const response = await h
        .agent()
        .post('/v1/vehicles/batch')
        // One real id and one that was never issued: the unavailable half of the
        // contract has to be exercised too.
        .send({ ids: [liveVehicleId, '2f9a6f1e-0000-4000-8000-000000000000'] })
        .expect(200);

      const parsed = conforms(VehicleBatchResponse, response.body);
      expect(parsed.unavailable).toHaveLength(1);
      expect(parsed.unavailable[0]?.reason).toBe('NOT_FOUND');
    });

    it('GET /v1/vehicles/:slug', async () => {
      conforms(VehicleDetail, (await h.agent().get(`/v1/vehicles/${liveSlug}`).expect(200)).body);
    });

    it('GET /v1/vehicles/:id/similar', async () => {
      const response = await h.agent().get(`/v1/vehicles/${liveVehicleId}/similar`).expect(200);
      conforms(VehicleListResponse.pick({ data: true }).passthrough(), response.body);
    });

    it('GET /v1/dealers', async () => {
      conforms(
        DealerDirectoryResponse,
        (await h.agent().get('/v1/dealers?limit=12').expect(200)).body,
      );
    });

    it('GET /v1/dealers/:slug', async () => {
      conforms(
        DealerPublicProfile,
        (await h.agent().get(`/v1/dealers/${DEALER_A}`).expect(200)).body,
      );
    });

    it('GET /v1/dealers/:slug/vehicles', async () => {
      conforms(
        DealerVehiclesResponse,
        (await h.agent().get(`/v1/dealers/${DEALER_A}/vehicles?limit=6`).expect(200)).body,
      );
    });

    it('POST /v1/enquiries', async () => {
      const response = await h
        .agent()
        .post('/v1/enquiries')
        .send({
          vehicleId: liveVehicleId,
          name: 'Contract Test',
          phone: '9876543210',
          message: 'Is this still available for a test drive this weekend?',
          source: 'LISTING_PAGE',
        })
        .expect(201);

      conforms(EnquiryCreatedResponse, response.body);
    });

    it('POST /v1/vehicles/:id/reveal-contact', async () => {
      conforms(
        RevealContactResponse,
        (
          await h
            .agent()
            .post(`/v1/vehicles/${liveVehicleId}/reveal-contact`)
            .send({ name: 'Contract Test' })
            .expect(200)
        ).body,
      );
    });
  });

  describe('dealer', () => {
    it('GET /v1/dealer', async () => {
      conforms(DealerProfile, (await h.agent().get('/v1/dealer').expect(200)).body);
    });

    it('GET /v1/auth/me', async () => {
      conforms(SessionResponse, (await h.agent().get('/v1/auth/me').expect(200)).body);
    });

    it('GET /v1/dealer/dashboard', async () => {
      conforms(DashboardResponse, (await h.agent().get('/v1/dealer/dashboard').expect(200)).body);
    });

    it('GET /v1/dealer/documents', async () => {
      conforms(
        DealerDocumentsResponse,
        (await h.agent().get('/v1/dealer/documents').expect(200)).body,
      );
    });

    it('GET /v1/dealer/vehicles', async () => {
      conforms(
        InventoryResponse,
        (await h.agent().get('/v1/dealer/vehicles?limit=12').expect(200)).body,
      );

      // Each tab, because the empty-state block differs per filter.
      for (const status of ['DRAFT', 'PENDING', 'ACTIVE', 'SOLD']) {
        conforms(
          InventoryResponse,
          (await h.agent().get(`/v1/dealer/vehicles?status=${status}`).expect(200)).body,
        );
      }
    });

    it('GET /v1/dealer/vehicles/:id and POST /submit', async () => {
      const vehicleId = await createSubmittableVehicle(h);
      conforms(
        DealerVehicleDto,
        (await h.agent().get(`/v1/dealer/vehicles/${vehicleId}`).expect(200)).body,
      );

      const submit = await h
        .agent()
        .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
        .send({})
        .expect(201);
      conforms(SubmitListingResponse, submit.body);

      // And the admin side of the same listing.
      conforms(
        ModerationQueueResponse,
        (await h.agent().get('/v1/admin/listings?status=PENDING_REVIEW&limit=12').expect(200)).body,
      );
      conforms(
        ApproveListingResponse,
        (
          await h
            .agent()
            .post(`/v1/admin/listings/${submit.body.listingId}/approve`)
            .send({})
            .expect(200)
        ).body,
      );
    });

    it('GET /v1/dealer/enquiries and /counts', async () => {
      conforms(
        EnquiryListResponse,
        (await h.agent().get('/v1/dealer/enquiries?limit=12').expect(200)).body,
      );
      conforms(
        EnquiryCountsResponse,
        (await h.agent().get('/v1/dealer/enquiries/counts').expect(200)).body,
      );
    });

    it('GET /v1/dealer/billing/*', async () => {
      conforms(
        BillingSummary,
        (await h.agent().get('/v1/dealer/billing/summary').expect(200)).body,
      );
      const packs = conforms(
        CreditPacksResponse,
        (await h.agent().get('/v1/dealer/billing/packs').expect(200)).body,
      );
      conforms(
        LedgerResponse,
        (await h.agent().get('/v1/dealer/billing/ledger?limit=12').expect(200)).body,
      );

      const pack = packs.data[0];
      expect(pack).toBeDefined();
      const order = conforms(
        CreateOrderResponse,
        (await h.agent().post('/v1/dealer/billing/orders').send({ packId: pack?.id }).expect(201))
          .body,
      );
      conforms(
        VerifyOrderResponse,
        (
          await h
            .agent()
            .post(`/v1/dealer/billing/orders/${order.orderId}/verify`)
            .send({})
            .expect(200)
        ).body,
      );
      conforms(
        InvoicesResponse,
        (await h.agent().get('/v1/dealer/billing/invoices?limit=12').expect(200)).body,
      );
    });
  });

  describe('admin', () => {
    it('GET /v1/admin/dealers', async () => {
      conforms(
        AdminDealersResponse,
        (await h.agent().get('/v1/admin/dealers?limit=12').expect(200)).body,
      );
    });

    it('GET /v1/admin/listings across every queue tab', async () => {
      for (const status of ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED']) {
        conforms(
          ModerationQueueResponse,
          (await h.agent().get(`/v1/admin/listings?status=${status}&limit=12`).expect(200)).body,
        );
      }
    });
  });
});
