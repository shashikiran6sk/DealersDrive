/**
 * Reads the yard's pin — and the place it names — out of each dealership's Maps
 * link, for the rows that predate them.
 *
 *     pnpm --filter @dealers-drive/api maps:backfill -- --dry-run
 *     pnpm --filter @dealers-drive/api maps:backfill
 *     pnpm --filter @dealers-drive/api maps:backfill -- --all
 *
 * ── Why a script ────────────────────────────────────────────────────────────
 * `lat`/`lng` and `mapsPlaceId` are resolved at **write time** — on
 * registration, and on a profile save that changes the link. That is the right
 * place for it: a dealer is present, the link is fresh, and nothing else has to
 * remember. It does nothing at all for the dealerships that registered before
 * the portfolio had a map, whose rows carry a link and no coordinates and would
 * keep showing the empty slot until somebody happened to re-save their address.
 *
 * So this walks them once. By default it only touches rows that are missing
 * something a link could supply; `--all` re-resolves every row, which is what
 * to run if a link's target has moved.
 *
 * ── The place id is worth a second run ──────────────────────────────────────
 * **R14** added `mapsPlaceId`, which is what turns the portfolio's frame from
 * an unlabelled dot into Google's place card — the yard's name, address, rating
 * and a directions control inside the map. A stored place URL already carries
 * the id and has it read back out at request time, so those rows need nothing.
 * The ones that do are the `maps.app.goo.gl` links, whose id costs the same
 * redirect the pin cost: a row with a pin and no place id is exactly the case
 * this picks up on its next run.
 *
 * ── It is also the honest way to check the resolver ─────────────────────────
 * The unit tests stub `fetch`, so they pin the redirect walk and the host
 * check but say nothing about what Google actually answers a server with. A
 * `--dry-run` over real dealerships does: it prints what each link resolved to
 * without writing anything, which is the fastest way to find out whether the
 * `maps.app.goo.gl` links your dealers actually paste can be followed.
 */
import { PrismaClient } from '@prisma/client';

import { createMapsResolver } from '../src/platform/maps/maps-link.js';

const prisma = new PrismaClient();
const maps = createMapsResolver();
const dryRun = process.argv.includes('--dry-run');
const all = process.argv.includes('--all');

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const dealers = await prisma.dealer.findMany({
    where: {
      mapsUrl: { not: null },
      ...(all ? {} : { OR: [{ lat: null }, { lng: null }, { mapsPlaceId: null }] }),
    },
    select: {
      id: true,
      slug: true,
      mapsUrl: true,
      lat: true,
      lng: true,
      mapsPlaceId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  log(
    `\n${String(dealers.length)} dealership(s) with a Maps link` +
      `${all ? '' : ' and something missing'}${dryRun ? '  (dry run)' : ''}\n`,
  );

  let resolved = 0;
  let unresolved = 0;

  for (const dealer of dealers) {
    // The `where` above guarantees it; Prisma's type cannot know that.
    const found = await maps.placeFor(dealer.mapsUrl ?? '');

    if (!found.coordinates && !found.placeId) {
      unresolved += 1;
      log(`  ·  ${dealer.slug}\n     no pin and no place in ${dealer.mapsUrl ?? ''}`);
      continue;
    }

    // Nothing is written when the answer is what is already stored, so a
    // re-run over settled data is a read.
    if (
      found.coordinates?.lat === dealer.lat &&
      found.coordinates?.lng === dealer.lng &&
      found.placeId === dealer.mapsPlaceId
    ) {
      continue;
    }

    if (!dryRun) {
      await prisma.dealer.update({
        where: { id: dealer.id },
        data: {
          lat: found.coordinates?.lat ?? null,
          lng: found.coordinates?.lng ?? null,
          mapsPlaceId: found.placeId,
        },
      });
    }

    resolved += 1;
    const pin = found.coordinates
      ? `${String(found.coordinates.lat)}, ${String(found.coordinates.lng)}`
      : 'no pin';
    log(`  ✓  ${dealer.slug}\n     ${pin}${found.placeId ? `  ·  ${found.placeId}` : ''}`);
  }

  log(
    `\n${String(resolved)} row(s) ${dryRun ? 'would be written' : 'written'}, ` +
      `${String(unresolved)} link(s) could not be followed.\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`\nbackfill failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
