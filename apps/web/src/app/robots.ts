import type { MetadataRoute } from 'next';
import { connection } from 'next/server';

import { robotsTxt } from '@/lib/seo';

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return robotsTxt();
}
