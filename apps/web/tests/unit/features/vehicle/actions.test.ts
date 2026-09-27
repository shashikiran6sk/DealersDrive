import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createVehicleAction,
  saveVehicleStepAction,
  submitVehicleAction,
} from '../../../../src/features/vehicle/actions.js';

const ORIGINAL_FETCH = globalThis.fetch;

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];

function respond(status: number, body: unknown = {}): typeof fetch {
  return vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    } as unknown as Response);
  }) as unknown as typeof fetch;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function bodyOf(call: Call | undefined): Record<string, unknown> {
  return typeof call?.init.body === 'string'
    ? (JSON.parse(call.init.body) as Record<string, unknown>)
    : {};
}

const ID = '22222222-2222-4222-8222-222222222222';

function vehicle(issues: { field: string; message: string }[] = []) {
  return { id: ID, issues, complete: issues.length === 0 };
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('createVehicleAction', () => {
  it('refuses a plate the parser cannot read, without calling the API', async () => {
    globalThis.fetch = respond(201, vehicle());
    const state = await createVehicleAction({}, form({ registrationNumber: 'ZZ 01 AB 1234' }));

    expect(state.errors?.registrationNumber).toMatch(/state code/);
    expect(state.values?.registrationNumber).toBe('ZZ 01 AB 1234');
    expect(calls).toHaveLength(0);
  });

  it('sends the canonical plate and nothing else, then opens the basics step', async () => {
    globalThis.fetch = respond(201, vehicle());

    await expect(
      createVehicleAction({}, form({ registrationNumber: 'ka-1-ab-1', dealerId: 'evil' })),
    ).rejects.toThrow(`NEXT_REDIRECT:/dealer/vehicles/${ID}/edit?step=basics`);
    expect(bodyOf(calls[0])).toEqual({ registrationNumber: 'KA01AB0001' });
    expect(calls[0]?.url).toMatch(/\/v1\/dealer\/vehicles$/);
  });

  it('puts a duplicate refusal on the plate field', async () => {
    globalThis.fetch = respond(409, {
      status: 409,
      code: 'DUPLICATE_REGISTRATION',
      title: 'Duplicate registration',
      detail: 'You already have a vehicle with this registration number.',
      errors: [
        {
          field: 'body.registrationNumber',
          code: 'DUPLICATE_REGISTRATION',
          message: 'You already have a vehicle with this registration number.',
        },
      ],
    });

    const state = await createVehicleAction({}, form({ registrationNumber: 'KA01AB1234' }));
    expect(state.errors?.registrationNumber).toMatch(/already have/);
    expect(state.message).toBeUndefined();
  });

  it('says the API is unavailable when it cannot be reached', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    const state = await createVehicleAction({}, form({ registrationNumber: 'KA01AB1234' }));
    expect(state.message).toMatch(/could not save/i);
  });
});

describe('saveVehicleStepAction', () => {
  const basics = {
    vehicleId: ID,
    step: 'basics',
    make: 'Hyundai',
    model: 'Creta',
    variant: '',
    manufacturingYear: '2023',
    registrationYear: '',
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SUV',
  };

  it('sends only this step’s fields, clearing emptied ones with null', async () => {
    globalThis.fetch = respond(
      200,
      vehicle([{ field: 'pricePaise', message: 'Price is required.' }]),
    );

    await expect(
      saveVehicleStepAction({}, form({ ...basics, intent: 'continue', status: 'ACTIVE' })),
    ).rejects.toThrow(`NEXT_REDIRECT:/dealer/vehicles/${ID}/edit?step=details`);

    expect(bodyOf(calls[0])).toEqual({
      make: 'Hyundai',
      model: 'Creta',
      variant: null,
      manufacturingYear: 2023,
      registrationYear: null,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      bodyType: 'SUV',
    });
    expect(calls[0]?.init.method).toBe('PATCH');
    expect(calls[0]?.url).toContain(`/v1/dealer/vehicles/${ID}`);
  });

  it('holds Continue on a step the API still finds incomplete, and keeps what was typed', async () => {
    globalThis.fetch = respond(
      200,
      vehicle([{ field: 'bodyType', message: 'Body type is required.' }]),
    );

    const state = await saveVehicleStepAction(
      {},
      form({ ...basics, bodyType: '', intent: 'continue' }),
    );
    expect(state.errors).toEqual({ bodyType: 'Body type is required.' });
    expect(state.values?.make).toBe('Hyundai');
  });

  it('saves and stays on the step for Save draft', async () => {
    globalThis.fetch = respond(200, vehicle([{ field: 'make', message: 'Make is required.' }]));
    await expect(
      saveVehicleStepAction({}, form({ ...basics, make: '', intent: 'draft' })),
    ).rejects.toThrow(`NEXT_REDIRECT:/dealer/vehicles/${ID}/edit?step=basics&saved=1`);
  });

  it('saves and goes back for Back', async () => {
    globalThis.fetch = respond(200, vehicle());
    await expect(saveVehicleStepAction({}, form({ ...basics, intent: 'back' }))).rejects.toThrow(
      `NEXT_REDIRECT:/dealer/vehicles/${ID}/edit?step=registration`,
    );
  });

  it('converts rupees to paise on the pricing step', async () => {
    globalThis.fetch = respond(200, vehicle());
    await expect(
      saveVehicleStepAction(
        {},
        form({
          vehicleId: ID,
          step: 'pricing',
          priceRupees: '₹14,50,000',
          negotiability: 'FIXED',
          description: 'One owner.',
          intent: 'continue',
        }),
      ),
    ).rejects.toThrow('step=review');
    expect(bodyOf(calls[0])).toMatchObject({ pricePaise: 145_000_000 });
  });

  it('refuses letters in a number without calling the API', async () => {
    globalThis.fetch = respond(200, vehicle());
    const state = await saveVehicleStepAction(
      {},
      form({
        vehicleId: ID,
        step: 'details',
        kilometersDriven: 'twenty thousand',
        ownerCount: '1',
        color: 'RED',
        insuranceType: 'NONE',
        insuranceValidUntil: '',
        intent: 'continue',
      }),
    );
    expect(state.errors?.kilometersDriven).toBe('Enter digits only.');
    expect(calls).toHaveLength(0);
  });

  it('names a price the schema refuses on the rupee field', async () => {
    globalThis.fetch = respond(200, vehicle());
    const state = await saveVehicleStepAction(
      {},
      form({ vehicleId: ID, step: 'pricing', priceRupees: '50', intent: 'continue' }),
    );
    expect(state.errors?.priceRupees).toMatch(/at least/);
  });

  it('refuses a request that names no vehicle or an unknown step', async () => {
    const missing = await saveVehicleStepAction({}, form({ step: 'basics' }));
    const review = await saveVehicleStepAction({}, form({ vehicleId: ID, step: 'review' }));
    const photos = await saveVehicleStepAction({}, form({ vehicleId: ID, step: 'photos' }));

    for (const state of [missing, review, photos]) expect(state.message).toBeTruthy();
  });

  it('shows the API’s sentence when it names no field', async () => {
    globalThis.fetch = respond(404, {
      status: 404,
      code: 'VEHICLE_NOT_FOUND',
      title: 'Not found',
      detail: 'That vehicle does not exist.',
    });
    const state = await saveVehicleStepAction({}, form({ ...basics, intent: 'continue' }));
    expect(state.message).toBe('That vehicle does not exist.');
  });
});

describe('submitVehicleAction', () => {
  it('submits with no body and opens the confirmation', async () => {
    globalThis.fetch = respond(200, vehicle());
    await expect(submitVehicleAction({}, form({ vehicleId: ID }))).rejects.toThrow(
      `NEXT_REDIRECT:/dealer/vehicles/${ID}/edit?step=review&submitted=1`,
    );
    expect(calls[0]?.url).toContain(`/v1/dealer/vehicles/${ID}/submit`);
    expect(calls[0]?.init.method).toBe('POST');
  });

  it('shows the API’s sentence when the vehicle is incomplete', async () => {
    globalThis.fetch = respond(422, {
      status: 422,
      code: 'VEHICLE_INCOMPLETE',
      title: 'Vehicle incomplete',
      detail: 'A few details are still missing.',
      errors: [{ field: 'pricePaise', code: 'REQUIRED', message: 'Price is required.' }],
    });
    const state = await submitVehicleAction({}, form({ vehicleId: ID }));
    expect(state.message).toBe('A few details are still missing.');
    expect(state.errors).toEqual({ priceRupees: 'Price is required.' });
  });

  it('says so when another dealership already has the car in review', async () => {
    globalThis.fetch = respond(409, {
      status: 409,
      code: 'DUPLICATE_REGISTRATION',
      title: 'Duplicate registration',
      detail: 'This registration number is already with Dealers-Drive for another listing.',
    });
    const state = await submitVehicleAction({}, form({ vehicleId: ID }));
    expect(state.message).toMatch(/already with Dealers-Drive/);
  });

  it('refuses a form that names no vehicle, and survives an unreachable API', async () => {
    expect((await submitVehicleAction({}, form({}))).message).toBeTruthy();
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('down')));
    expect((await submitVehicleAction({}, form({ vehicleId: ID }))).message).toMatch(
      /could not save/i,
    );
  });
});
