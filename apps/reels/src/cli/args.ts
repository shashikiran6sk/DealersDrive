import { parseArgs } from 'node:util';

export const DEFAULT_API_BASE = 'https://api.dealers-drive.com';
export const DEFAULT_OUT_DIR = 'out';

export type RenderOptions = {
  dealers: string[];
  apiBase: string;
  outDir: string;
  musicPath: string | null;
  asOf: Date;
  propsOnly: boolean;
  concurrency: number | null;
  help: boolean;
};

export const USAGE = [
  'Usage: pnpm --filter @dealers-drive/reels render -- [options]',
  '',
  '  --dealer <slug>     Render one dealership (repeatable). Default: every dealership with cars.',
  '  --api <url>         API origin. Default: https://api.dealers-drive.com',
  '  --out <dir>         Where the MP4s go. Default: out/',
  '  --music <file>      An audio track to lay under every reel (faded in and out).',
  '  --as-of <date>      The "prices as of" date, YYYY-MM-DD. Default: today.',
  '  --props-only        Fetch data and images, write props JSON, render nothing.',
  '  --concurrency <n>   Browser tabs per render. Default: Remotion decides.',
  '  --help              Show this message.',
].join('\n');

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(value: string): Date {
  const match = DATE_PATTERN.exec(value);
  if (match === null) throw new Error(`--as-of must be YYYY-MM-DD, got "${value}"`);
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0));
  if (date.getUTCMonth() !== (month ?? 0) - 1 || date.getUTCDate() !== day) {
    throw new Error(`--as-of is not a real date: "${value}"`);
  }
  return date;
}

function today(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function parseRenderArgs(argv: readonly string[], now: Date): RenderOptions {
  const { values } = parseArgs({
    args: [...argv].filter((arg) => arg !== '--'),
    strict: true,
    allowPositionals: false,
    options: {
      dealer: { type: 'string', multiple: true },
      api: { type: 'string' },
      out: { type: 'string' },
      music: { type: 'string' },
      'as-of': { type: 'string' },
      'props-only': { type: 'boolean' },
      concurrency: { type: 'string' },
      help: { type: 'boolean' },
    },
  });

  const concurrency = values.concurrency === undefined ? null : Number(values.concurrency);
  if (concurrency !== null && (!Number.isInteger(concurrency) || concurrency < 1)) {
    throw new Error(`--concurrency must be a positive whole number, got "${values.concurrency}"`);
  }

  return {
    dealers: values.dealer ?? [],
    apiBase: values.api ?? DEFAULT_API_BASE,
    outDir: values.out ?? DEFAULT_OUT_DIR,
    musicPath: values.music ?? null,
    asOf: values['as-of'] === undefined ? today(now) : parseDate(values['as-of']),
    propsOnly: values['props-only'] ?? false,
    concurrency,
    help: values.help ?? false,
  };
}
