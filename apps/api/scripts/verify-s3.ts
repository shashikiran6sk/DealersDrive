/**
 * Proves the real S3 path works before you touch the UI.
 *
 * Run from apps/api so dotenv finds the repo-root .env:
 *   cd apps/api && pnpm exec tsx scripts/verify-s3.ts
 *
 * It exercises exactly what the API does: HeadBucket, a presigned PUT performed
 * over plain fetch (what the browser does), then head/get/delete.
 */
import { env } from '../src/config/env.js';
import { createS3Client, createS3Storage } from '../src/platform/storage/s3.adapter.js';

const KEY = `verify/${Date.now()}.txt`;
const BODY = Buffer.from('dealers-drive s3 connectivity check\n');

function ok(step: string, detail = ''): void {
  process.stdout.write(`  ok   ${step}${detail ? ` — ${detail}` : ''}\n`);
}

async function main(): Promise<void> {
  process.stdout.write(
    `\ndriver=${env.STORAGE_DRIVER} endpoint=${env.S3_ENDPOINT} region=${env.S3_REGION}\n` +
      `bucket=${env.S3_BUCKET} pathStyle=${env.S3_FORCE_PATH_STYLE}\n\n`,
  );

  if (env.STORAGE_DRIVER === 'local') {
    throw new Error('STORAGE_DRIVER is `local` — nothing here talks to AWS. Set it to `r2`.');
  }

  const client = createS3Client();
  const storage = createS3Storage(client);

  // 1. Credentials + bucket reachable. Needs s3:ListBucket on the bucket ARN.
  const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
  await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  ok('HeadBucket', 'credentials valid, bucket reachable');

  // 2. Presign — the URL the API hands the browser.
  const presigned = await storage.presignPut({
    key: KEY,
    contentType: 'text/plain',
    contentLength: BODY.byteLength,
  });
  ok('presignPut', new URL(presigned.uploadUrl).host);

  // 3. The upload itself, over fetch, with the signed headers verbatim. This is
  //    the step that fails if the signature or bucket policy is wrong.
  const put = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: presigned.headers,
    body: BODY,
  });
  if (!put.ok) {
    throw new Error(`PUT ${put.status} ${put.statusText}\n${await put.text()}`);
  }
  ok('PUT to presigned URL', `${put.status}`);

  // 4. What commit() does: verify the bytes that landed.
  const head = await storage.head(KEY);
  if (!head) throw new Error('head() found nothing — the object did not land.');
  if (head.bytes !== BODY.byteLength) {
    throw new Error(`head() says ${head.bytes} bytes, expected ${BODY.byteLength}.`);
  }
  ok('head', `${head.bytes} bytes, ${head.contentType}`);

  // 5. What the /media delivery route does.
  const got = await storage.get(KEY);
  if (!got || !got.equals(BODY)) throw new Error('get() returned different bytes.');
  ok('get', 'bytes match');

  // 6. Signed read — how KYC documents are served.
  const readUrl = await storage.signedReadUrl(KEY, 60);
  const read = await fetch(readUrl);
  if (!read.ok) throw new Error(`signed GET ${read.status}: ${await read.text()}`);
  ok('signedReadUrl', `${read.status}`);

  await storage.delete(KEY);
  if (await storage.head(KEY)) throw new Error('delete() left the object behind.');
  ok('delete', 'cleaned up');

  process.stdout.write('\nAll good. The API can use this bucket.\n\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`\nFAILED: ${describe(error)}\n\n`);
  process.exit(1);
});

/**
 * AWS SDK errors are frequently more informative in their name, HTTP status or
 * `cause` than in `message` — a refused connection arrives with a blank message,
 * which reads as a silent failure unless the rest is unpacked.
 */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  // A failed connection surfaces as an AggregateError holding one error per
  // address the resolver tried (IPv6 then IPv4), with nothing in `message`.
  if (error instanceof AggregateError) {
    const inner = error.errors.map((e: unknown) => describe(e));
    return `${error.name}${error.message ? `: ${error.message}` : ''}\n  ${[...new Set(inner)].join('\n  ')}`;
  }

  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  const parts = [
    [error.name, error.message].filter(Boolean).join(': ') || 'unknown error',
    status ? `(HTTP ${status})` : '',
    error.cause instanceof Error ? `\n  cause: ${error.cause.name}: ${error.cause.message}` : '',
  ];
  return parts.filter(Boolean).join(' ');
}
