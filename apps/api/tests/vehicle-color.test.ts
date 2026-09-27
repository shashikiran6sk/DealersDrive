import { normaliseVehicleColor, VehicleColor } from '@dealers-drive/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * Generic colours (**R52**). A car's colour is one of twelve families, never a
 * shade name; the free text that came before is kept in `legacyColor` and read
 * into a family by `dd_vehicle_color`, the migration's own backfill.
 */
let h: AuthHarness;
let dealer: Dealership;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  dealer = await marketplaceFixtures(h, 'vehicle-color').dealership();
});

afterAll(async () => {
  await h.close();
});

const SAMPLES = [
  'Pearl White',
  'Polar White',
  'Magma Grey',
  'Titan Gray',
  'Silky Silver',
  'Midnight Black',
  'Phantom Black',
  'Fiery Red',
  'Maroon',
  'Navy Blue',
  'Nexa Blue',
  'Midnight Blue',
  'Racing Green',
  'Pearl Brown',
  'Beige',
  'Sunset Orange',
  'Yellow',
  'Deep Forest',
  'Red with black roof',
  'Blackberry',
  'Greyish',
  'white',
  'OTHER',
  'Silver',
  '  ',
  '',
];

describe('the backfill the migration ran', () => {
  it('reads every colour exactly as the TypeScript rule does', async () => {
    for (const sample of SAMPLES) {
      const rows = await h.prisma.$queryRaw<{ color: string | null }[]>`
        SELECT dd_vehicle_color(${sample})::text AS color`;
      expect({ sample, color: rows[0]?.color ?? null }).toEqual({
        sample,
        color: normaliseVehicleColor(sample),
      });
    }
  });

  it('files a shade under its family, and anything ambiguous under Other', async () => {
    const read = async (raw: string) =>
      (
        await h.prisma.$queryRaw<
          { color: string }[]
        >`SELECT dd_vehicle_color(${raw})::text AS color`
      )[0]?.color;
    expect(await read('Phantom Black')).toBe('BLACK');
    expect(await read('Deep Forest')).toBe('OTHER');
    expect(await read('Red with black roof')).toBe('OTHER');
    expect(await read('Blackberry')).toBe('OTHER');
  });
});

describe('what the API accepts', () => {
  async function draft(plate: string): Promise<string> {
    const created = await dealer.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: plate })
      .expect(201);
    return created.body.id as string;
  }

  it('takes one of the twelve families and answers with it', async () => {
    const id = await draft('KL 07 CL 1001');
    const saved = await dealer.agent
      .patch(`/v1/dealer/vehicles/${id}`)
      .send({ color: 'SILVER' })
      .expect(200);
    expect(saved.body.color).toBe('SILVER');
    const row = await h.prisma.vehicle.findUniqueOrThrow({ where: { id } });
    expect(row.color).toBe('SILVER');
    expect(row.legacyColor).toBeNull();
  });

  it.each(['Fiery Red', 'red', 'Pearl White', 'MAGENTA'])(
    'refuses %s, naming the field',
    async (color) => {
      const id = await draft(`KL 07 CL ${String(1100 + color.length)}`);
      const refused = await dealer.agent
        .patch(`/v1/dealer/vehicles/${id}`)
        .send({ color })
        .expect(400);
      expect(JSON.stringify(refused.body)).toContain('color');
    },
  );

  it('offers exactly the families the database holds', async () => {
    const rows = await h.prisma.$queryRaw<{ value: string }[]>`
      SELECT unnest(enum_range(NULL::"VehicleColor"))::text AS value`;
    expect(rows.map((row) => row.value)).toEqual(VehicleColor.options);
  });
});
