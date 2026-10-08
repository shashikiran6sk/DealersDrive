import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const vehiclesDocs: ModuleDocs = {
  tag: DOC_TAGS.vehicles,
  description:
    'A dealership’s own vehicles, entered by hand (**F055**, **F063**; **R46**).\n\n' +
    'A vehicle starts as a draft created from its registration number and is filled in one ' +
    'wizard step at a time with `PATCH`. Nothing here looks the registration up anywhere: ' +
    'there is no RC, VAHAN or third-party call on this path.\n\n' +
    '**No photographs.** Dealers-Drive photographs every car itself and an admin uploads the ' +
    'processed images (**R45**), so no schema on this router accepts an image, a media id or a ' +
    'storage key, and none accepts a status or a dealer id. Each of those is a 400 naming the ' +
    'field.\n\n' +
    '**Tenant scope.** Every path is looked up as `{ id, dealerId }` with the dealer id taken ' +
    'from the session, so another dealership’s vehicle is a 404, never a 403.\n\n' +
    '**Write authorization.** After acquiring an existing listing lock, writes recheck ' +
    'the current membership, role, dealership, account and cookie session inside the transaction. ' +
    'Revoked access is `401`; a role that lost the required permission is `403`. ' +
    'An authorization row held by another operation returns `409 AUTHORIZATION_BUSY` without ' +
    'changing stock; retry the request after that operation completes. Draft preparation ' +
    'remains available before dealer approval, while lifecycle moves require an ACTIVE dealer.\n\n' +
    'Every response here is `Cache-Control: no-store`.',
  operations: [
    {
      method: 'get',
      path: '/v1/dealer/vehicles',
      operationId: 'listDealerVehicles',
      tag: DOC_TAGS.vehicles,
      summary: 'Your inventory',
      description:
        'Every vehicle the dealership has entered, newest first, with its listing status ' +
        '(**F066**). `status` filters to one listing status; `q` matches the registration ' +
        'number (separators ignored) or the make or model. Cursor-paginated.\n\n' +
        '`counts` gives the number of vehicles in each status plus `ALL`, unaffected by the ' +
        'filter, so the tabs need no second request and switching tab never empties them.',
      audience: 'dealer',
      permission: 'vehicle:read',
      query: 'DealerInventoryQuery',
      responses: [
        { status: 200, description: 'A page of the inventory.', schema: 'DealerInventoryResponse' },
      ],
      errors: [400, 401, 403, 409],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles',
      operationId: 'createVehicle',
      tag: DOC_TAGS.vehicles,
      summary: 'Start a vehicle from its registration number',
      description:
        'Creates a draft holding only the registration number — the wizard’s first ' +
        'step. The number is parsed by the same `RegistrationNumber` schema the console uses, ' +
        'so `KA-01-AB-1234`, `ka01ab1234` and `KA 1 AB 1234` are all stored as `KA01AB1234`.\n\n' +
        'A dealership holds a registration once: a second vehicle with the same number is a ' +
        '`409 DUPLICATE_REGISTRATION` naming `body.registrationNumber`. The check is a partial ' +
        'unique index, so two tabs racing get one draft and one 409.',
      audience: 'dealer',
      permission: 'vehicle:write',
      requestBody: {
        schema: 'CreateVehicleInput',
        example: { registrationNumber: 'KA 01 AB 1234' },
      },
      responses: [{ status: 201, description: 'The new draft.', schema: 'DealerVehicle' }],
      errors: [400, 401, 403, 409],
    },
    {
      method: 'get',
      path: '/v1/dealer/vehicles/suggestions',
      operationId: 'suggestVehicleValues',
      tag: DOC_TAGS.vehicles,
      summary: 'Makes or models already in use',
      description:
        'Distinct values other vehicles already carry, matched by prefix and case-insensitively, ' +
        'at most eight. It is the suggest-existing guard rail D1 asked for and R46 made ' +
        'universal: offering `Maruti Suzuki` as a dealer types `mar` is what stops the ' +
        'marketplace fragmenting into three spellings of one brand. It is a suggestion, never a ' +
        'closed list.',
      audience: 'dealer',
      permission: 'vehicle:read',
      query: 'VehicleSuggestQuery',
      responses: [{ status: 200, description: 'Suggestions.', schema: 'VehicleSuggestions' }],
      errors: [400, 401, 403],
    },
    {
      method: 'get',
      path: '/v1/dealer/vehicles/:id',
      operationId: 'getDealerVehicle',
      tag: DOC_TAGS.vehicles,
      summary: 'One of your vehicles',
      description:
        'The vehicle as its dealership sees it, with `issues` — what stands between it and ' +
        'a submission, evaluated by the same `vehicleIssues()` the console imports — so the ' +
        'wizard renders what is missing rather than deciding it.',
      audience: 'dealer',
      permission: 'vehicle:read',
      params: 'IdParam',
      responses: [{ status: 200, description: 'The vehicle.', schema: 'DealerVehicle' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'patch',
      path: '/v1/dealer/vehicles/:id',
      operationId: 'updateDealerVehicle',
      tag: DOC_TAGS.vehicles,
      summary: 'Save a wizard step',
      description:
        'Partial by design: the wizard sends only the current step’s fields, so `Back` ' +
        'never blanks another step. An omitted field is left alone; `null` clears an optional ' +
        'one.\n\n' +
        'A make or model typed in a different case from one already in use adopts the stored ' +
        'spelling. Money is integer paise (`pricePaise: 145000000` is ₹14,50,000).\n\n' +
        'Changing the registration number re-runs the duplicate check against the ' +
        'dealership’s other vehicles.',
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'IdParam',
      requestBody: {
        schema: 'UpdateVehicleInput',
        description: 'Only the fields being changed.',
        example: {
          make: 'Hyundai',
          model: 'Creta',
          variant: 'SX(O)',
          manufacturingYear: 2023,
          fuelType: 'PETROL',
          transmission: 'AUTOMATIC',
          bodyType: 'SUV',
        },
      },
      responses: [{ status: 200, description: 'The vehicle as saved.', schema: 'DealerVehicle' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'delete',
      path: '/v1/dealer/vehicles/:id',
      operationId: 'deleteDealerVehicle',
      tag: DOC_TAGS.vehicles,
      summary: 'Discard a vehicle',
      description:
        'Deletes the vehicle outright and releases its registration number. The deletion is ' +
        'audit-logged with the number it held.',
      audience: 'dealer',
      permission: 'vehicle:delete',
      params: 'IdParam',
      responses: [{ status: 204, description: 'Deleted.' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/submit',
      operationId: 'submitDealerVehicle',
      tag: DOC_TAGS.vehicles,
      summary: 'Submit a vehicle for review',
      description:
        'Moves the listing from `DRAFT` (or `CHANGES_REQUESTED`, as a resubmission) to ' +
        '`PENDING_REVIEW` (**F065**, **R47**). When legal enforcement is active, requires the current listing certification, account Terms and Dealer Agreement. The vehicle is submitted as it is ' +
        'stored.\n\n' +
        '**Complete or refused.** The same `vehicleIssues()` the wizard shows decides it; ' +
        'anything missing is a `422 VEHICLE_INCOMPLETE` with one entry per field in `errors`.\n\n' +
        '**Race-safe.** The listing row is locked for the length of the check, so an edit ' +
        'arriving at the same moment waits and is then refused as not editable, and a second ' +
        'submit of the same vehicle is a `409` rather than a second count.\n\n' +
        '**One car on the marketplace once.** Submitting claims the registration across every ' +
        'dealership; if another dealership already has the same car in review or on sale this is ' +
        'a `409 DUPLICATE_REGISTRATION` that does not say which.\n\n' +
        'The dealership must be ACTIVE (`403 DEALER_NOT_ACTIVE`). After submission Dealers-Drive ' +
        'photographs the car (**R45**); no image is ever supplied here.',
      audience: 'dealer',
      permission: 'listing:submit',
      requiresActiveDealer: true,
      params: 'IdParam',
      requestBody: { schema: 'SubmitVehicleInput', required: false },
      responses: [
        {
          status: 200,
          description: 'The vehicle, with its listing now `PENDING_REVIEW`.',
          schema: 'DealerVehicle',
        },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/reserve',
      operationId: 'reserveDealerVehicle',
      tag: DOC_TAGS.vehicles,
      summary: 'Reserve a car for a buyer',
      description:
        'Moves the listing from `ACTIVE` to `RESERVED` (**R69**). A reserved car stays on the ' +
        'marketplace, marked Reserved, but cannot be opened from a card or enquired about. The ' +
        'dealership can still mark it sold; putting it back on sale takes an admin\u2019s ' +
        'approval of a `request-reactivation`.\n\n' +
        'Any other state is a `409 LISTING_NOT_RESERVABLE` carrying `listingStatus`. The listing ' +
        'row is locked and the new state is written with the old one in the `WHERE`, so two ' +
        'moves racing on one car land one and refuse the other with `409 LISTING_STATE_CHANGED`.',
      audience: 'dealer',
      permission: 'listing:reserve',
      requiresActiveDealer: true,
      params: 'IdParam',
      responses: [
        {
          status: 200,
          description: 'The vehicle, with its listing now `RESERVED`.',
          schema: 'DealerVehicle',
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/mark-sold',
      operationId: 'markDealerVehicleSold',
      tag: DOC_TAGS.vehicles,
      summary: 'Mark a car sold',
      description:
        'Moves the listing from `ACTIVE` or `RESERVED` to `SOLD` (**F067**, **R69**). A sold car ' +
        'leaves every public surface and no longer counts as stock; the record, its enquiries ' +
        'and its audit trail are kept. The registration is released, so the same car can be ' +
        'listed again by whoever sells it next.\n\n' +
        '**There is no way back.** No route moves a listing out of `SOLD`; a sale recorded by ' +
        'mistake is an administrative correction. A reactivation request still waiting on a ' +
        'reserved car is closed (`CANCELLED`) by the sale. Anything but an active or reserved car is a ' +
        '`409 LISTING_NOT_SELLABLE`.',
      audience: 'dealer',
      permission: 'listing:sell',
      requiresActiveDealer: true,
      params: 'IdParam',
      responses: [
        {
          status: 200,
          description: 'The vehicle, with its listing now `SOLD`.',
          schema: 'DealerVehicle',
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/withdraw',
      operationId: 'withdrawDealerVehicle',
      tag: DOC_TAGS.vehicles,
      summary: 'Withdraw a listing without selling it',
      description:
        'Moves the listing from `ACTIVE` to `WITHDRAWN` (**R69**): off the marketplace and not ' +
        'sold. The dealership keeps holding the registration while it is withdrawn, and can ' +
        'ask for it to go back on sale with `request-reactivation` — an admin decides.\n\n' +
        '`reason` is one of five and is required; `note` is optional, at most 500 characters. ' +
        'Both are the dealership’s own record and appear in no public response. Anything but an ' +
        'active car is a `409 LISTING_NOT_WITHDRAWABLE`.',
      audience: 'dealer',
      permission: 'listing:withdraw',
      requiresActiveDealer: true,
      params: 'IdParam',
      requestBody: {
        schema: 'WithdrawListingInput',
        example: { reason: 'TEMPORARILY_PAUSED', note: 'Back after the service.' },
      },
      responses: [
        {
          status: 200,
          description: 'The vehicle, with its listing now `WITHDRAWN`.',
          schema: 'DealerVehicle',
        },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/request-reactivation',
      operationId: 'requestDealerVehicleReactivation',
      tag: DOC_TAGS.vehicles,
      summary: 'Ask to put a reserved or withdrawn car back on sale',
      description:
        'A dealership cannot move a listing from `RESERVED` or `WITHDRAWN` back to `ACTIVE` ' +
        'itself: that is an admin decision. This files a reactivation request an admin approves ' +
        'or rejects; the listing does not move until then, and `listing.reactivation` on the ' +
        'response says where the request stands.\n\n' +
        '`reason` is optional, at most 500 characters, and is read only by the reviewer. The ' +
        'body is required as a JSON object, so an empty request is `{}`.\n\n' +
        'Anything but a reserved or withdrawn car is a `409 LISTING_NOT_REACTIVATABLE`; a ' +
        'request already waiting on the same listing is a `409 REACTIVATION_ALREADY_PENDING` ' +
        '(one pending request per listing is also a database constraint).',
      audience: 'dealer',
      permission: 'listing:reactivate',
      requiresActiveDealer: true,
      params: 'IdParam',
      requestBody: {
        schema: 'RequestReactivationInput',
        example: { reason: 'The buyer backed out; the car is available again.' },
      },
      responses: [
        {
          status: 200,
          description: 'The vehicle, its listing unchanged, with a pending `reactivation`.',
          schema: 'DealerVehicle',
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
  ],
};
