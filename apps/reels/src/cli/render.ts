import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

import { reelBedWav, whooshWav } from '../audio';
import { fetchDealersWithStock, fetchInventory, fetchProfile } from '../data/api';
import { buildReelProps, hasShowcase } from '../data/build-props';
import { planMedia } from '../data/media';
import { IMAGE_WIDTH, REEL_COMPOSITION_ID } from '../reel/reel.constants';
import type { ReelProps, ReelSound } from '../reel/reel.types';

import { parseRenderArgs, USAGE } from './args';
import { downloadAll } from './download';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_DIR = join(APP_DIR, '.cache');
const PUBLIC_DIR = join(CACHE_DIR, 'public');
const PROPS_DIR = join(CACHE_DIR, 'props');
const ENTRY_POINT = join(APP_DIR, 'src/index.ts');
const BED_FILE = 'audio/reel-bed.wav';
const WHOOSH_FILE = 'audio/whoosh.wav';

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function stageSound(musicPath: string | null, silent: boolean): Promise<ReelSound> {
  if (silent) return { music: null, whoosh: null };
  await mkdir(join(PUBLIC_DIR, 'audio'), { recursive: true });
  await writeFile(join(PUBLIC_DIR, WHOOSH_FILE), whooshWav());
  if (musicPath === null) {
    await writeFile(join(PUBLIC_DIR, BED_FILE), reelBedWav());
    return { music: BED_FILE, whoosh: WHOOSH_FILE };
  }
  const music = `audio/${basename(musicPath)}`;
  await copyFile(resolve(process.cwd(), musicPath), join(PUBLIC_DIR, music));
  return { music, whoosh: WHOOSH_FILE };
}

async function main(): Promise<void> {
  const options = parseRenderArgs(process.argv.slice(2), new Date());
  if (options.help) {
    say(USAGE);
    return;
  }

  const fetcher = (url: string) => fetch(url);
  const slugs =
    options.dealers.length > 0
      ? options.dealers
      : (await fetchDealersWithStock(options.apiBase, fetcher)).map((dealer) => dealer.slug);
  say(`Dealerships to render: ${slugs.length}`);

  const media = planMedia(IMAGE_WIDTH);
  const sound = await stageSound(options.musicPath, options.silent);
  const reels: Array<{ slug: string; props: ReelProps }> = [];

  for (const slug of slugs) {
    const [profile, inventory] = await Promise.all([
      fetchProfile(options.apiBase, slug, fetcher),
      fetchInventory(options.apiBase, slug, fetcher),
    ]);
    if (!hasShowcase(inventory.cards)) {
      say(`  skip ${slug}: no available car with a photo`);
      continue;
    }
    const props = buildReelProps({
      profile,
      cards: inventory.cards,
      available: inventory.available,
      asOf: options.asOf,
      sound,
      imageSrc: media.src,
    });
    reels.push({ slug, props });
    say(`  ${slug}: ${inventory.available} available, featuring ${props.featured.length}`);
  }

  say(`Downloading ${media.files().size} images`);
  await downloadAll(media.files(), PUBLIC_DIR, fetcher);

  await mkdir(PROPS_DIR, { recursive: true });
  for (const { slug, props } of reels) {
    await writeFile(join(PROPS_DIR, `${slug}.json`), `${JSON.stringify(props, null, 2)}\n`);
  }
  if (options.propsOnly) {
    say(`Props written to ${PROPS_DIR}`);
    return;
  }

  say('Bundling the reel');
  const serveUrl = await bundle({ entryPoint: ENTRY_POINT, publicDir: PUBLIC_DIR });
  const browserExecutable = process.env.REELS_BROWSER_EXECUTABLE ?? null;
  const outDir = resolve(process.cwd(), options.outDir);
  await mkdir(outDir, { recursive: true });

  for (const { slug, props } of reels) {
    const composition = await selectComposition({
      serveUrl,
      id: REEL_COMPOSITION_ID,
      inputProps: props,
      browserExecutable,
    });
    const outputLocation = join(outDir, `${slug}.mp4`);
    let reported = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      pixelFormat: 'yuv420p',
      crf: 18,
      inputProps: props,
      outputLocation,
      browserExecutable,
      concurrency: options.concurrency,
      onProgress: ({ progress }) => {
        const tenth = Math.floor(progress * 10);
        if (tenth > reported) {
          reported = tenth;
          say(`  ${slug}: ${tenth * 10}%`);
        }
      },
    });
    say(`Rendered ${outputLocation}`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
