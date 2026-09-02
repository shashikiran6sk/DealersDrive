import type { ModuleDocs } from '../../docs/spec.js';

/**
 * C6–C13. Inventory and the listing lifecycle.
 *
 * The distinction that runs through this whole group: a **vehicle** is the
 * dealer's record of a car, and a **listing** is a publication of it. A vehicle
 * is created and edited freely; a listing costs a credit and needs approval. The
 * two have separate statuses, and the API returns a single derived
 * `displayStatus` so no client has to combine them itself.
 */
export const vehiclesDocs: ModuleDocs = {
  tag: 'Dealer inventory',
  description:
    "The dealer's cars and the listings that publish them. Scoped to the session's " +
    "dealership throughout — another dealer's vehicle id answers **404, not 403**, because a " +
    '403 would confirm the id is real.\n\n' +
    '**Money is always integer paise.** `pricePaise: 645000` is ₹6,450 — not ₹6.45 Lakh. ' +
    'A fractional value is a 400.',
  operations: [
    {
      method: 'get',
      path: '/v1/dealer/vehicles',
      operationId: 'listInventory',
      tag: 'Dealer inventory',
      summary: "List the dealer's inventory",
      description:
        'Cursor-paginated inventory, filterable by the derived `displayStatus` — the same ' +
        'value the tabs in the console show (DRAFT, PENDING, ACTIVE, SOLD and so on) rather ' +
        'than the raw vehicle or listing status.\n\n' +
        '`q` searches make, model and variant.',
      audience: 'dealer',
      permission: 'vehicle:read',
      query: 'InventoryQuery',
      responses: [
        {
          status: 200,
          description:
            'A page of inventory rows, the per-tab counts, and an `emptyState` block when ' +
            'there is nothing to show for the current filter.',
          schema: 'InventoryResponse',
        },
      ],
      errors: [400, 401, 403],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles',
      operationId: 'createVehicle',
      tag: 'Dealer inventory',
      summary: 'Create a draft vehicle',
      description:
        'Step 1 of the add-vehicle wizard. Takes only the identity of the car — make, model, ' +
        'variant, year, fuel, transmission, body type — the first three ids from the ' +
        'catalogue, never free text, which is what makes search facets exact.\n\n' +
        '**All seven are required**, `variantId` included: a `Swift VXi` and a `Swift ZXi+` ' +
        'are a lakh apart, so a listing without a variant is described rather than ' +
        'identified.\n\n' +
        'Creates a **DRAFT**. Nothing is published and no credit is touched; price, ' +
        'kilometres, photos and description arrive via PATCH, and publishing is a separate ' +
        'call.',
      audience: 'dealer',
      permission: 'vehicle:write',
      requestBody: {
        schema: 'CreateVehicleInput',
        description:
          "The car's identity. `makeId`/`modelId` come from `GET /v1/catalog/bundle`; " +
          '`variantId` from `GET /v1/catalog/models/{modelId}/variants`.',
        example: {
          makeId: 'b1d4f8e2-5555-4000-8000-000000000005',
          modelId: 'c2e5a9f3-6666-4000-8000-000000000006',
          variantId: 'd3f6b0a4-7777-4000-8000-000000000007',
          year: 2021,
          fuel: 'PETROL',
          transmission: 'MANUAL',
          bodyType: 'HATCHBACK',
        },
      },
      responses: [{ status: 201, description: 'The new draft.', schema: 'DealerVehicleDto' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/lookup',
      operationId: 'lookupVehicleByRegistration',
      tag: 'Dealer inventory',
      summary: 'Look a vehicle up by its number plate',
      description:
        'Takes a registration number and returns a **proposal** — the catalogue rows we ' +
        'believe it matches, the detail fields the RC can fill, and the vehicle records ' +
        'check.\n\n' +
        'Nothing is written. A lookup is not a commitment to list the car; the dealer ' +
        'confirms the basics and `POST /v1/dealer/vehicles` creates the draft.\n\n' +
        '**Every field carries a `confidence`.** `EXACT` is stated, `LIKELY` is offered for ' +
        'confirmation, `NONE` must be chosen. `variantId` is *always* `NONE` with a ranked ' +
        '`candidates` list — RC trim strings are truncated and inconsistent, and a `Swift ' +
        'VXi` might be a VXi, a VXi (O) or a VXi AMT, which are a lakh apart. ' +
        '`transmission` is always `NONE` too: **a registration certificate does not record ' +
        'the gearbox.**\n\n' +
        '**This call costs money.** It is rate-limited to 20 per hour per dealership and ' +
        'results are cached for 30 days, so a repeat lookup of the same plate is free. ' +
        'A not-found answer is cached for one hour — long enough to stop a mistyped plate ' +
        'being billed ten times, short enough that a new registration is not invisible for ' +
        'a month.\n\n' +
        'Returns **404** when no RC is on record and **503** when the records service is ' +
        'unreachable. Both are expected outcomes, not exceptions: roughly one lookup in six ' +
        'does not produce a usable match, and every client must offer manual entry as a ' +
        'first-class path rather than a retry.',
      audience: 'dealer',
      permission: 'vehicle:write',
      requestBody: {
        schema: 'RcLookupInput',
        description:
          'Spaces, hyphens and case are all optional — a dealer reading a windscreen should ' +
          'not have to guess our separator.',
        example: { regNumber: 'TN09BX1234' },
      },
      responses: [
        {
          status: 200,
          description:
            'The proposal. `report` is null when the records feature is off; ' +
            '`advisories[]` carries what the dealer must be told but which blocks nothing.',
          schema: 'RcLookupResponse',
        },
      ],
      errors: [400, 401, 403, 404, 422, 429, 503],
    },
    {
      method: 'get',
      path: '/v1/dealer/vehicles/:id',
      operationId: 'getVehicle',
      tag: 'Dealer inventory',
      summary: 'One vehicle, with completeness and credit preview',
      description:
        "The dealer's own view of a car, including three things the public view has no " +
        'equivalent of:\n\n' +
        '- `completeness` — percent done, what is missing, and `canSubmit`, plus `blockers[]` ' +
        'phrased for a dealer to act on\n' +
        '- `creditPreview` — the balance now, what publishing costs, and the balance after, ' +
        'so step 4 of the wizard can say "credits after publish · 22"\n' +
        '- `media[]` — every photo with its processing status\n\n' +
        "Another dealer's id is a 404.",
      audience: 'dealer',
      permission: 'vehicle:read',
      params: 'IdParam',
      responses: [{ status: 200, description: 'The vehicle.', schema: 'DealerVehicleDto' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'patch',
      path: '/v1/dealer/vehicles/:id',
      operationId: 'updateVehicle',
      tag: 'Dealer inventory',
      summary: 'Update a vehicle',
      description:
        'Partial, so each wizard step sends only its own fields and an untouched step never ' +
        "blanks another's.\n\n" +
        '`pricePaise` is **paise** and must be an integer — `450000.5` is a 400. ' +
        "`status`, `slug` and `dealerId` are not in the schema at all: a listing's status " +
        'changes only through the state machine, so posting `{"status":"APPROVED"}` is a 400 ' +
        'rather than a silent success (rules 1 and 5).',
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'IdParam',
      requestBody: {
        schema: 'UpdateVehicleInput',
        description: 'Only the fields being changed.',
        example: {
          kmDriven: 42_180,
          ownerNumber: 1,
          pricePaise: 64_500_000,
          priceNegotiable: 'SLIGHTLY',
          description:
            'Single-owner car with full service history and four new tyres. Non-accidental, ' +
            'available for inspection at the showroom any day.',
          features: ['Power steering', 'Air conditioning', 'Rear camera'],
        },
      },
      responses: [{ status: 200, description: 'The updated vehicle.', schema: 'DealerVehicleDto' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'delete',
      path: '/v1/dealer/vehicles/:id',
      operationId: 'deleteVehicle',
      tag: 'Dealer inventory',
      summary: 'Delete a vehicle',
      description:
        'Soft-deletes the vehicle and removes it from the catalogue. Requires ' +
        '`vehicle:delete`, which is a narrower permission than `vehicle:write` — a ' +
        'salesperson can neither write nor delete, and the two are separate so a future role ' +
        'can edit without being able to destroy.',
      audience: 'dealer',
      permission: 'vehicle:delete',
      params: 'IdParam',
      responses: [{ status: 204, description: 'Deleted.' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/submit',
      operationId: 'submitVehicleListing',
      tag: 'Dealer inventory',
      summary: 'Submit for review (holds one credit)',
      description:
        'Creates a listing in **PENDING_REVIEW** and **holds one listing credit** in the same ' +
        'database transaction. Takes no body.\n\n' +
        'What happens to that credit is the whole lifecycle:\n\n' +
        '| Outcome | Ledger | Balance |\n' +
        '| --- | --- | --- |\n' +
        '| submit | `HOLD_SUBMIT` −1 | drops by one |\n' +
        '| approved | `CONSUME_APPROVE` 0 | unchanged — the credit is spent |\n' +
        '| rejected | `RELEASE_REJECT` +1 | returned |\n' +
        '| changes requested | *no row* | unchanged, **still held** |\n\n' +
        'That last row is the one to notice: a resubmission after CHANGES_REQUESTED reuses ' +
        'the existing hold and is **not** charged again. The surviving hold is the only thing ' +
        'separating "request changes" from "reject".\n\n' +
        'Refused with 422 when the vehicle is incomplete (`VEHICLE_INCOMPLETE`), has too few ' +
        'photos (`TOO_FEW_PHOTOS`), the profile is incomplete (`PROFILE_INCOMPLETE`) or the ' +
        'balance is zero (`INSUFFICIENT_CREDITS`); 409 `ALREADY_SUBMITTED` when a listing is ' +
        'already live or in review; 403 `DEALER_NOT_ACTIVE` when the dealership is not ' +
        'approved yet.',
      audience: 'dealer',
      permission: 'listing:submit',
      requiresActiveDealer: true,
      params: 'IdParam',
      responses: [
        {
          status: 201,
          description: 'The listing is in review and one credit is held.',
          schema: 'SubmitListingResponse',
          example: {
            listingId: '8d1e4c77-7777-4000-8000-000000000007',
            status: 'PENDING_REVIEW',
            displayStatus: 'PENDING',
            statusLabel: 'Pending approval',
            submittedAt: '2026-08-17T09:20:00.000Z',
            expectedReviewBy: '2026-08-18T09:20:00.000Z',
            credit: {
              held: 1,
              balanceBefore: 39,
              balanceAfter: 38,
              transactionId: '5b7a2e91-8888-4000-8000-000000000008',
              note: 'One credit is held now and spent when the listing is approved. If we reject it, the credit returns to your balance. Approved listings stay live for 90 days.',
            },
            message: 'Your listing is with our team. Most listings are reviewed within 24 hours.',
          },
        },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/mark-sold',
      operationId: 'markVehicleSold',
      tag: 'Dealer inventory',
      summary: 'Mark a car sold',
      description:
        'Records the sale and marks the listing **SOLD**. The car **stays on the marketplace**: ' +
        'it keeps its place in search results, renders with a `Sold` badge, and is inert — no ' +
        'link to its detail page, no enquiry, no phone reveal. `GET /v1/vehicles/{slug}` 404s ' +
        'for it from this moment, so a stale link cannot open a car that is gone.\n\n' +
        'It is excluded from every *available* count — `resultLabel`, city counts, body-type ' +
        'tiles, facets and price ranges all mean available — and sorts after every available ' +
        'car on every sort order.\n\n' +
        'Use `POST /remove-listing` instead to take it off the marketplace entirely.\n\n' +
        'The sold price is optional and private — it is never shown publicly. No credit is ' +
        'returned: the listing did its job.',
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'IdParam',
      requestBody: {
        schema: 'MarkSoldInput',
        description: 'Optionally the sold price (paise) and date.',
        required: false,
        example: { soldPricePaise: 62_500_000 },
      },
      responses: [
        {
          status: 200,
          description: 'Sold, still visible, no longer available.',
          schema: 'MarkSoldResponse',
          example: {
            displayStatus: 'SOLD',
            statusLabel: 'Sold',
            markedSoldAt: '2026-08-26T09:12:00.000Z',
            remainsVisible: true,
            message:
              'Marked sold. The car stays on the marketplace with a Sold badge — buyers can see it but not open or enquire about it. Remove the listing if you would rather it went.',
          },
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/remove-listing',
      operationId: 'removeVehicleListing',
      tag: 'Dealer inventory',
      summary: 'Withdraw a listing from the marketplace',
      description:
        'Takes the car off the customer-facing marketplace. The listing moves to **REMOVED** ' +
        'with `removedAt` set and its row leaves `listing_search`, so buyers stop seeing it ' +
        'everywhere at once — search, counts, the dealer page and its detail page.\n\n' +
        "The **vehicle row survives**. It returns to `DRAFT`, stays in the dealer's inventory, " +
        'remains editable, and can be submitted again for a fresh credit — and the listing and ' +
        'its ledger rows remain as the record that this car was once advertised. Withdrawing a ' +
        'listing that was already SOLD leaves the vehicle SOLD; it removes the advertisement, ' +
        'not the sale.\n\n' +
        'Distinct from `DELETE /v1/dealer/vehicles/{id}`, which soft-deletes the vehicle itself ' +
        'and 409s while a listing is live. Withdrawing is the thing to do first.\n\n' +
        'Only an **APPROVED**, **EXPIRED** or **SOLD** listing can be withdrawn — those are the ' +
        'three states a car is publicly visible in. Anything else is a 409 ' +
        '`INVALID_TRANSITION`. The consumed credit is not returned.',
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'IdParam',
      responses: [
        {
          status: 200,
          description: 'Off the marketplace; the vehicle is retained.',
          schema: 'RemoveListingResponse',
          example: {
            displayStatus: 'REMOVED',
            statusLabel: 'Removed',
            removedAt: '2026-08-26T09:12:00.000Z',
            vehicleRetained: true,
            canRelist: true,
            message:
              'Removed from the marketplace. The car is back in your inventory as a draft — submitting it again costs one credit.',
          },
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/dealer/listings/:id/renew',
      operationId: 'renewListing',
      tag: 'Dealer inventory',
      summary: 'Renew an expired listing',
      description:
        'Puts an **EXPIRED** listing back into review, holding a fresh credit — a renewal is ' +
        'a new publication, not a free extension. Only an expired listing can be renewed; ' +
        'anything else is a 409 `INVALID_TRANSITION`.\n\n' +
        'Note the path: this one takes a **listing** id, not a vehicle id.',
      audience: 'dealer',
      permission: 'listing:renew',
      requiresActiveDealer: true,
      params: 'IdParam',
      responses: [
        {
          status: 201,
          description: 'Back in review, with a new credit held.',
          schema: 'RenewListingResponse',
        },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'get',
      path: '/v1/dealer/vehicles/:id/report',
      operationId: 'getVehicleReport',
      tag: 'Dealer inventory',
      summary: "The vehicle's records check",
      description:
        'Blacklist status, NOC, traffic challans, and insurance/PUC/fitness/tax validity, ' +
        'as of the moment the provider answered.\n\n' +
        'This is the **itemised** view — every challan with its date, offence, amount and ' +
        'status. The public listing page carries a narrower summary with aggregates and ' +
        'offence types only; see `VehicleReportSummary`.\n\n' +
        'What it never contains, at either granularity: the registered owner, the person ' +
        'named on a challan, any mobile number, the place of an offence, or the chassis and ' +
        'engine numbers. Those are dropped by the provider adapter and are not stored.\n\n' +
        '`asOf` and `stale` are the important fields. A records check is a claim about a ' +
        'point in time, and a client that renders the findings without the date is ' +
        'misrepresenting it.',
      audience: 'dealer',
      permission: 'vehicle:read',
      params: 'IdParam',
      responses: [
        {
          status: 200,
          description: 'The current report, or null when none has been fetched.',
          schema: 'VehicleReportDto',
        },
      ],
      errors: [401, 403, 404],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/report/refresh',
      operationId: 'refreshVehicleReport',
      tag: 'Dealer inventory',
      summary: 'Re-read the records now',
      description:
        'Forces a fresh provider call — the button a dealer presses after paying off a ' +
        'challan.\n\n' +
        'Records are also refreshed automatically when a listing is submitted, so this is ' +
        'for impatience rather than correctness. It is rate-limited to 10 per hour per ' +
        'dealership: it is the one endpoint where holding down a button spends our money.\n\n' +
        'Unlike the refresh inside submit, this one **surfaces its failure**. The dealer ' +
        'pressed a button and deserves to know it did not work, rather than staring at an ' +
        'unchanged date.',
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'IdParam',
      responses: [
        { status: 200, description: 'The refreshed report.', schema: 'VehicleReportDto' },
      ],
      errors: [401, 403, 404, 422, 429, 503],
    },
  ],
};
