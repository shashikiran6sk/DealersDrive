import { PrismaClient } from '@prisma/client';

/**
 * One-off: resolve the plate collision blocking `20260902120000_rc_lookup`.
 *
 * ## What went wrong
 *
 * That migration adds a partial unique index — one live car per plate per
 * dealer — and `CREATE UNIQUE INDEX` refuses to build over existing duplicates.
 * On the Neon dev database two vehicles share `TN23AJ6159`.
 *
 * ## Why nothing is deleted
 *
 * They are **not** two copies of one car: a 2019 Aventador at 40,000 km and a
 * 2021 at 45,000 km, both APPROVED and live, both typed with the same
 * registration during manual testing. The later one has two enquiries against
 * it. Both are wanted; only the collision is not.
 *
 * ## The replacement plate
 *
 * `TN23SK6159` rather than the requested `TN@#SK6159`, which `REGISTRATION_NUMBER`
 * rejects — the contract allows `[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}` (or a BH
 * series), so `@` and `#` cannot appear. Writing a value the API's own schema
 * refuses would leave a row that fails validation the moment a dealer opens the
 * edit form, on a field they never touched. `TN23SK6159` keeps the requested
 * `SK` and `6159`, and keeps the TN-23 RTO the original resolved to, so
 * `rtoCodeFromPlate` still agrees with the vehicle's stored `rtoCode`.
 *
 * ## Undo
 *
 *   UPDATE vehicles SET "regNumberMasked" = 'TN23AJ6159'
 *   WHERE id = 'a1ac62bb-65e7-4809-be7a-82b8c0132e2f';
 *
 * Run with:
 *   pnpm exec tsx scripts/fix-plate-collision.ts          # report only
 *   pnpm exec tsx scripts/fix-plate-collision.ts --apply  # write
 */
const TARGET = 'a1ac62bb-65e7-4809-be7a-82b8c0132e2f'; // 2019 Aventador, no enquiries
const OLD_PLATE = 'TN23AJ6159';
const NEW_PLATE = 'TN23SK6159';

/** `verify-s3.ts` writes to stdout directly; the repo bans bare `console`. */
function say(line = ''): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();

  try {
    // Raw SQL throughout: the generated client expects the columns the failed
    // migration never created, so a typed read on `vehicles` throws P2022.
    const collisions = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT v."dealerId",
             v."regNumberMasked",
             count(*)::int                                       AS copies,
             string_agg(v.id::text, ', ' ORDER BY v."createdAt")  AS ids
        FROM vehicles v
       WHERE v."deletedAt" IS NULL
         AND v."regNumberMasked" IS NOT NULL
       GROUP BY 1, 2
      HAVING count(*) > 1
    `);

    if (collisions.length === 0) {
      say('No plate collisions. The migration can be applied as it stands.');
      return;
    }

    say(`${collisions.length} collision(s):`);
    for (const row of collisions) {
      say(
        `  dealer ${String(row.dealerId)} plate ${String(row.regNumberMasked)} — ${String(row.ids)}`,
      );
    }

    if (!apply) {
      say(`\nDry run. Re-run with --apply to move ${TARGET} to ${NEW_PLATE}.`);
      return;
    }

    // Guarded on the old value as well as the id, so re-running after a manual
    // edit is a no-op rather than an overwrite of somebody else's correction.
    const changed = await prisma.$executeRawUnsafe(
      // `id` is uuid; a bound parameter arrives as text, so the cast is required.
      `UPDATE vehicles SET "regNumberMasked" = $1 WHERE id = $2::uuid AND "regNumberMasked" = $3`,
      NEW_PLATE,
      TARGET,
      OLD_PLATE,
    );
    say(`\n${TARGET}: ${OLD_PLATE} → ${NEW_PLATE} (${changed} row updated)`);

    const remaining = await prisma.$queryRawUnsafe<unknown[]>(`
      SELECT 1 FROM vehicles
       WHERE "deletedAt" IS NULL AND "regNumberMasked" IS NOT NULL
       GROUP BY "dealerId", "regNumberMasked" HAVING count(*) > 1
    `);
    say(
      remaining.length === 0
        ? 'No collisions remain — the migration will now apply.'
        : `${remaining.length} collision(s) still remain; resolve them before migrating.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
