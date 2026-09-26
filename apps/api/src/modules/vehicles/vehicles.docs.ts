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
    'Every response here is `Cache-Control: no-store`.',
  operations: [
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
      errors: [400, 401, 403, 404],
    },
  ],
};
