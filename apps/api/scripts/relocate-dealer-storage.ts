/**
 * Moves every dealership onto the new slug and the new bucket layout.
 *
 *     pnpm --filter @dealers-drive/api storage:relocate -- --dry-run
 *     pnpm --filter @dealers-drive/api storage:relocate
 *
 * ── What changed, and why anything has to move ──────────────────────────────
 * Two things landed together, and each one on its own would have been harmless:
 *
 *   · a dealership's slug is now `name-city-district-state` rather than just
 *     the name, so that a portfolio URL and a bucket folder both say where the
 *     yard is;
 *   · every object a dealership owns now lives under one folder,
 *     `dealers/{slug}/`, instead of splitting the KYC scans into `kyc/{uuid}/`
 *     and the yard photograph into `dealers/{uuid}/yard/`.
 *
 * A KYC document's key is *derived* from the slug rather than stored
 * (`dealer-storage-keys.ts`), which is what makes the pair breaking: change the
 * slug and the derivation stops naming the file that is actually there. So the
 * bytes move in the same pass as the row, and this script is the only thing in
 * the codebase permitted to write `dealers.slug` after registration.
 *
 * ── What it does per dealership ─────────────────────────────────────────────
 *   1. computes the new slug with `dealerSlug`, disambiguating against every
 *      slug already taken — including the ones this run has just assigned;
 *   2. copies each KYC object from its old derived key to its new one;
 *   3. copies each `media` row's object to its new key and updates
 *      `media.storageKey`, which *is* stored;
 *   4. writes the new slug;
 *   5. deletes the old objects, and only the ones that copied.
 *
 * Nothing is deleted before its copy has been read back, and a dealership whose
 * objects fail to copy keeps its old slug — a half-moved dealership is a
 * dealership whose documents a moderator cannot open, and the derivation is
 * what would be lying. Re-running is safe: a dealership already in the right
 * place has nothing to copy and nothing to rename.
 */
import { dealerSlug } from '@dealers-drive/contracts';
import { PrismaClient, type DealerDocType } from '@prisma/client';

import { env } from '../src/config/env.js';
import { documentKey, yardPhotoKey } from '../src/modules/dealers/dealer-storage-keys.js';
import { createStorage } from '../src/platform/storage/factory.js';
import type { StoragePort } from '../src/platform/storage/storage.port.js';

const prisma = new PrismaClient();
const storage: StoragePort = createStorage();
const dryRun = process.argv.includes('--dry-run');

/** The layout before this change, so the old objects can be found. */
function legacyDocumentKey(dealerId: string, type: DealerDocType, documentId: string): string {
  return `kyc/${dealerId}/${type}/${documentId}`;
}

interface Move {
  from: string;
  to: string;
  /** Set for a `media` row, whose key is stored and has to be rewritten too. */
  mediaId?: string;
}

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

/**
 * Copy one object, and say which of the three things happened.
 *
 * `missing` is the ordinary case, not a failure: a DRAFT dealership has three
 * document rows and no uploads behind them. `failed` is the one that matters,
 * because it is what makes the dealership keep its slug.
 *
 * `StoragePort` has no server-side copy — deliberately, since the adapters
 * behind it do not agree on one — and these are KYC scans and yard
 * photographs, a few megabytes at the very worst.
 */
async function copy(move: Move): Promise<'copied' | 'missing' | 'failed'> {
  const source = await storage.head(move.from);
  if (!source) return 'missing';

  if (dryRun) return 'copied';

  const body = await storage.get(move.from);
  if (!body) return 'failed';

  await storage.put(move.to, body, source.contentType);
  return (await storage.head(move.to)) === null ? 'failed' : 'copied';
}

async function main(): Promise<void> {
  log(`\ndriver=${env.STORAGE_DRIVER} bucket=${env.S3_BUCKET}${dryRun ? '  (dry run)' : ''}\n`);

  const dealers = await prisma.dealer.findMany({
    orderBy: { createdAt: 'asc' },
    include: { documents: true },
  });

  // Every slug in the table, so a computed one that collides gets a suffix
  // rather than a unique-constraint failure halfway through a move.
  const taken = new Set(dealers.map((dealer) => dealer.slug));

  let renamed = 0;
  let copied = 0;
  let removed = 0;

  for (const dealer of dealers) {
    const media = await prisma.media.findMany({ where: { dealerId: dealer.id } });

    const base = dealerSlug({
      legalName: dealer.legalName,
      city: dealer.city,
      district: dealer.district,
      state: dealer.state,
    });

    let slug = dealer.slug;
    if (base !== dealer.slug) {
      taken.delete(dealer.slug);
      slug = base;
      for (let attempt = 2; taken.has(slug); attempt += 1) slug = `${base}-${attempt}`;
      taken.add(slug);
    }

    const moves: Move[] = [
      ...dealer.documents.map((doc) => ({
        from: legacyDocumentKey(dealer.id, doc.type, doc.id),
        to: documentKey(slug, doc.type, doc.id),
      })),
      ...media.map((row) => ({
        from: row.storageKey,
        to: yardPhotoKey(slug, row.id),
        mediaId: row.id,
      })),
    ].filter((move) => move.from !== move.to);

    const done: Move[] = [];
    let failed = 0;
    for (const move of moves) {
      const result = await copy(move);
      if (result === 'copied') done.push(move);
      else if (result === 'failed') failed += 1;
    }

    if (failed > 0) {
      log(
        `  SKIP ${dealer.slug} — ${String(failed)} object(s) would not copy; ` +
          'slug left as it is so the derivation still finds them.',
      );
      continue;
    }

    if (!dryRun) {
      for (const move of done) {
        if (move.mediaId) {
          await prisma.media.update({
            where: { id: move.mediaId },
            data: { storageKey: move.to },
          });
        }
      }
      if (slug !== dealer.slug) {
        await prisma.dealer.update({ where: { id: dealer.id }, data: { slug } });
      }
      // Last, and only what actually landed at the far end.
      for (const move of done) await storage.delete(move.from);
    }

    copied += done.length;
    removed += done.length;
    if (slug !== dealer.slug) {
      renamed += 1;
      log(`  ${dealer.slug}\n    → ${slug}   (${String(done.length)} object(s))`);
    } else if (done.length > 0) {
      log(`  ${slug}   (${String(done.length)} object(s) relocated)`);
    }
  }

  log(
    `\n${String(dealers.length)} dealership(s): ${String(renamed)} renamed, ` +
      `${String(copied)} object(s) copied, ${String(dryRun ? 0 : removed)} old object(s) deleted.\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`\nrelocate failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
