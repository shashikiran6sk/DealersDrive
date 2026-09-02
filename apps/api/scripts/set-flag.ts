import { PrismaClient } from '@prisma/client';

import { CONFIG_DEFAULTS } from '../src/platform/config/platform-config.js';

/**
 * Flip a boolean platform flag from the command line.
 *
 * The admin UI at `/admin/config` is the real way to do this — it is audited
 * and it is what an operator will use at 9pm. This exists for the case the UI
 * cannot cover: a fresh development database where the feature you are trying
 * to look at is switched off, which is every new checkout, because
 * `feature.rcLookup` and `feature.vehicleReport` both default to `false` so the
 * work ships dark.
 *
 * `label` and `valueType` are written alongside the value to match what
 * `PlatformConfigService.set` does — a row missing them renders in the admin
 * table with a raw key and no control. `updatedBy` is left null: the column is
 * a uuid holding the admin who made the change, and there is no honest id for
 * a script. Null reads as "not a person", which is exactly right.
 *
 *   pnpm exec tsx scripts/set-flag.ts                          # list flags
 *   pnpm exec tsx scripts/set-flag.ts feature.rcLookup on
 *   pnpm exec tsx scripts/set-flag.ts feature.vehicleReport off
 */
function say(line = ''): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const [key, state] = process.argv.slice(2);
  const prisma = new PrismaClient();

  try {
    if (!key) {
      const stored = new Map(
        (await prisma.platformConfig.findMany()).map((row) => [row.key, row.value]),
      );
      say('Boolean flags (● stored, ○ falling back to the code default):');
      for (const flag of CONFIG_DEFAULTS.filter((row) => row.type === 'boolean')) {
        const isStored = stored.has(flag.key);
        const value = isStored ? stored.get(flag.key) : flag.value;
        say(`  ${isStored ? '●' : '○'} ${value === true ? ' on' : 'off'}  ${flag.key}`);
      }
      say('\nUsage: pnpm exec tsx scripts/set-flag.ts <key> <on|off>');
      return;
    }

    const definition = CONFIG_DEFAULTS.find((row) => row.key === key);
    if (!definition) throw new Error(`Unknown config key: ${key}`);
    if (definition.type !== 'boolean') throw new Error(`${key} is not a boolean flag.`);
    if (state !== 'on' && state !== 'off') throw new Error('Second argument must be on or off.');

    const value = state === 'on';
    await prisma.platformConfig.upsert({
      where: { key },
      create: {
        key,
        value,
        label: definition.label,
        valueType: definition.type,
        updatedBy: null,
      },
      update: { value, updatedBy: null },
    });

    say(`${key} = ${String(value)}`);
    // The API caches config for five minutes and the web page caches
    // /v1/config/public for five more. Restarting dev is the quick way through
    // both; the admin UI bumps a cache version instead, which this cannot do
    // without a CachePort.
    say('Restart `pnpm run dev` (or wait ~5 minutes) for it to take effect.');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
