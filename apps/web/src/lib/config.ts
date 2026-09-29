import 'server-only';
import { z } from 'zod';

export interface ServerConfig {
  apiBaseUrl: string;
  webBaseUrl: string;
  appEnv: 'local' | 'development' | 'production';
}

const schema = z
  .object({
    APP_ENV: z.enum(['local', 'development', 'production']).default('local'),
    API_BASE_URL: z.url().default('http://localhost:4000'),
    WEB_BASE_URL: z.url().default('http://localhost:3000'),
  })
  .superRefine((value, ctx) => {
    if (value.APP_ENV !== 'production' || process.env.NODE_ENV !== 'production') return;
    for (const [key, url] of Object.entries({
      API_BASE_URL: value.API_BASE_URL,
      WEB_BASE_URL: value.WEB_BASE_URL,
    })) {
      if (!url.startsWith('https://') || new URL(url).hostname === 'localhost') {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'production requires a public HTTPS URL',
        });
      }
    }
  });

function parse(): ServerConfig {
  const parsed = schema.parse(process.env);
  return Object.freeze({
    apiBaseUrl: parsed.API_BASE_URL,
    webBaseUrl: parsed.WEB_BASE_URL,
    appEnv: parsed.APP_ENV,
  });
}

const resolved = process.env.NODE_ENV === 'test' ? undefined : parse();

export function serverConfig(): ServerConfig {
  return resolved ?? parse();
}

export interface ClientConfig {
  appEnv: ServerConfig['appEnv'];
  supportPhone: string;
  supportEmail: string;
  minPhotosPerListing: number;
  listingDurationDays: number;
}
