import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { Fetcher } from '../data/api';

const PARALLEL_DOWNLOADS = 6;

export async function downloadAll(
  files: Map<string, string>,
  publicDir: string,
  fetcher: Fetcher,
): Promise<void> {
  const queue = [...files.entries()].filter(([file]) => !existsSync(join(publicDir, file)));

  async function worker(): Promise<void> {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const [file, url] = next;
      const response = await fetcher(url);
      if (!response.ok) throw new Error(`Image ${url} answered ${response.status}`);
      const target = join(publicDir, file);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(await response.arrayBuffer()));
    }
  }

  await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, () => worker()));
}
