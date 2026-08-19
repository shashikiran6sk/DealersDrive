import { PrismaClient } from '@prisma/client';

import { env } from '../../src/config/env.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { CONFIG_DEFAULTS } from '../../src/platform/config/platform-config.js';
import { CITIES, COLORS, CREDIT_PACKS, MAKES, RTOS } from './data.js';

/**
 * Production bootstrap — everything a deployed environment needs before a real
 * dealer can be onboarded, and nothing else.
 *
 *   pnpm db:bootstrap
 *
 * `db:seed` cannot be used for this. It **truncates every application table**
 * before it writes, which is correct for a laptop and catastrophic anywhere a
 * dealer has signed in; and it invents five dealerships and twenty-three cars,
 * which is a demo, not a launch.
 *
 * What this writes:
 *   · the reference catalogue — cities, RTOs, colours, makes/models/variants.
 *     ARCHITECTURE §6.2: the catalogue is not optional. A dealer cannot list a
 *     car whose make does not exist, so an empty production database is not a
 *     blank slate, it is a broken product.
 *   · the credit packs shown on the billing screen.
 *   · the platform configuration defaults the admin console edits.
 *   · one platform admin, so somebody can approve the first dealership.
 *
 * **Create-if-missing, never overwrite.** Every write below is an upsert whose
 * update is empty, and that is the whole safety property: run it twice, run it
 * after six months of trading, run it against the wrong environment by mistake
 * — it cannot change a price an admin edited, a config value somebody tuned,
 * or any row a dealer owns. The single exception is the admin's password hash,
 * which is rotated deliberately (see below) and announced in the output.
 *
 * Run it as a one-off task from the migrator image, the same way migrations
 * run — see deploy/aws/README.md §11.
 */

const prisma = new PrismaClient();

/** The default that must never become a production admin's password. */
const LOCAL_ADMIN_PASSWORD = 'dealers-drive-local-admin';

interface Tally {
  created: number;
  existing: number;
}

const tally = (): Tally => ({ created: 0, existing: 0 });

async function count<T>(t: Tally, exists: Promise<T | null>, create: () => Promise<unknown>) {
  if (await exists) {
    t.existing += 1;
    return;
  }
  await create();
  t.created += 1;
}

async function bootstrapConfig(): Promise<Tally> {
  const t = tally();
  for (const entry of CONFIG_DEFAULTS) {
    await count(t, prisma.platformConfig.findUnique({ where: { key: entry.key } }), () =>
      prisma.platformConfig.create({
        data: { key: entry.key, value: entry.value, label: entry.label, valueType: entry.type },
      }),
    );
  }
  return t;
}

interface CatalogTally {
  cities: Tally;
  rtos: Tally;
  colors: Tally;
  makes: Tally;
  models: Tally;
  variants: Tally;
}

async function bootstrapCatalog(): Promise<CatalogTally> {
  const cities = tally();
  for (const city of CITIES) {
    await count(cities, prisma.city.findUnique({ where: { slug: city.slug } }), () =>
      prisma.city.create({ data: city }),
    );
  }

  const rtos = tally();
  for (const rto of RTOS) {
    await count(rtos, prisma.rto.findUnique({ where: { code: rto.code } }), () =>
      prisma.rto.create({ data: rto }),
    );
  }

  const colors = tally();
  for (const color of COLORS) {
    await count(colors, prisma.color.findUnique({ where: { slug: color.slug } }), () =>
      prisma.color.create({ data: color }),
    );
  }

  const makes = tally();
  const models = tally();
  const variants = tally();

  for (const make of MAKES) {
    let makeRow = await prisma.make.findUnique({ where: { slug: make.slug } });
    if (makeRow) {
      makes.existing += 1;
    } else {
      makeRow = await prisma.make.create({
        data: { slug: make.slug, name: make.name, popularity: make.popularity },
      });
      makes.created += 1;
    }

    for (const model of make.models) {
      let modelRow = await prisma.model.findUnique({
        where: { makeId_slug: { makeId: makeRow.id, slug: model.slug } },
      });
      if (modelRow) {
        models.existing += 1;
      } else {
        modelRow = await prisma.model.create({
          data: {
            makeId: makeRow.id,
            slug: model.slug,
            name: model.name,
            bodyType: model.bodyType,
            yearFrom: model.yearFrom,
          },
        });
        models.created += 1;
      }

      for (const variant of model.variants) {
        await count(
          variants,
          prisma.variant.findUnique({
            where: { modelId_slug: { modelId: modelRow.id, slug: variant.slug } },
          }),
          () => prisma.variant.create({ data: { modelId: modelRow.id, ...variant } }),
        );
      }
    }
  }

  return { cities, rtos, colors, makes, models, variants };
}

async function bootstrapPacks(): Promise<Tally> {
  const t = tally();
  for (const pack of CREDIT_PACKS) {
    await count(t, prisma.creditPack.findUnique({ where: { slug: pack.slug } }), () =>
      prisma.creditPack.create({ data: { ...pack, pricePaise: BigInt(pack.pricePaise) } }),
    );
  }
  return t;
}

/**
 * The one account with a password, and the only way into the admin console.
 *
 * The plaintext is read once from the environment, hashed with Argon2id, and
 * dropped — it is never stored, logged or returned, here or anywhere else.
 *
 * Re-running this **re-hashes the password**, which is deliberate: there is no
 * self-service password change for admins, so rotating `DEV_ADMIN_PASSWORD`
 * and re-running is the rotation procedure. It is also the one thing in this
 * script that changes an existing row, so it says so when it does.
 */
async function bootstrapAdmin(): Promise<'created' | 'rotated'> {
  const passwordHash = await hashPassword(env.DEV_ADMIN_PASSWORD);
  const existing = await prisma.user.findUnique({ where: { email: env.DEV_ADMIN_EMAIL } });

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
    return 'rotated';
  }

  await prisma.user.create({
    data: {
      fullName: 'Dealers-Drive Operations',
      roleTitle: 'Platform admin',
      email: env.DEV_ADMIN_EMAIL,
      emailVerifiedAt: new Date(),
      isPlatformAdmin: true,
      adminRole: 'SUPER_ADMIN',
      passwordHash,
    },
  });
  return 'created';
}

async function main(): Promise<void> {
  const started = Date.now();

  // The local default is a published string. An environment that reaches
  // production with it would hand the admin console to anyone who has read
  // this repository, so this refuses rather than warns.
  if (env.isProduction && env.DEV_ADMIN_PASSWORD === LOCAL_ADMIN_PASSWORD) {
    process.stderr.write(
      '\nDEV_ADMIN_PASSWORD is still the local development default.\n' +
        'Set a real one for this environment before bootstrapping it.\n\n',
    );
    process.exit(1);
  }

  process.stdout.write(`Bootstrapping ${env.APP_ENV} (${env.NODE_ENV})…\n`);

  const config = await bootstrapConfig();
  const catalog = await bootstrapCatalog();
  const packs = await bootstrapPacks();
  const admin = await bootstrapAdmin();

  const line = (label: string, t: Tally) =>
    `  ${label.padEnd(14)} ${String(t.created).padStart(3)} created, ${t.existing} already there`;

  process.stdout.write(
    [
      line('config', config),
      line('cities', catalog.cities),
      line('rtos', catalog.rtos),
      line('colours', catalog.colors),
      line('makes', catalog.makes),
      line('models', catalog.models),
      line('variants', catalog.variants),
      line('credit packs', packs),
      `  admin          ${env.DEV_ADMIN_EMAIL} (${admin === 'created' ? 'created' : 'password rotated'})`,
      `  done in ${((Date.now() - started) / 1000).toFixed(1)}s`,
      '',
    ].join('\n'),
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`\nBootstrap failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
