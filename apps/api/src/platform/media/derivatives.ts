import { createHash } from 'node:crypto';

import sharp from 'sharp';

import { DomainError } from '../errors.js';
import type { StoragePort } from '../storage/storage.port.js';
import { DERIVATIVE_WIDTHS } from './urls.js';

sharp.cache({ memory: 16, files: 0, items: 8 });
sharp.concurrency(1);

let tail: Promise<unknown> = Promise.resolve();

export function writeDerivatives(mediaId: string, body: Buffer, storage: StoragePort) {
  const work = tail.then(async () => {
    const hash = createHash('sha256').update(body).digest('hex');
    const variants: Record<string, string> = {};
    const outputs: { key: string; body: Buffer }[] = [];
    try {
      for (const width of DERIVATIVE_WIDTHS) {
        const output = await sharp(body, { limitInputPixels: 40_000_000, animated: false })
          .rotate()
          .resize({ width })
          .webp({ quality: 78, effort: 4 })
          .toBuffer();
        const key = `derivatives/${mediaId}/${hash}/${String(width)}.webp`;
        outputs.push({ key, body: output });
        variants[String(width)] = key;
      }
    } catch (error) {
      throw new DomainError('UPLOAD_NOT_IMAGE', 'The photograph cannot be decoded safely.', {
        cause: error,
      });
    }
    for (const output of outputs) await storage.put(output.key, output.body, 'image/webp');
    return variants;
  });
  tail = work.catch(() => undefined);
  return work;
}
