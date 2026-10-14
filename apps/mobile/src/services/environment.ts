import { z } from 'zod';

const PublicEnvironment = z
  .object({
    appEnv: z.enum(['development', 'preview', 'production']).default('development'),
    apiBaseUrl: z.url().default('http://10.0.2.2:4000'),
    webBaseUrl: z.url().default('http://10.0.2.2:3000'),
  })
  .strict()
  .superRefine((value, context) => {
    for (const key of ['apiBaseUrl', 'webBaseUrl']) {
      const raw = key === 'apiBaseUrl' ? value.apiBaseUrl : value.webBaseUrl;
      const url = new URL(raw);
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'Use a service origin without credentials, path, query or fragment.',
        });
      }
      if (
        url.protocol !== 'https:' &&
        !(value.appEnv === 'development' && url.protocol === 'http:')
      ) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'HTTPS is required outside local development.',
        });
      }
    }
  });

export type PublicEnvironment = z.infer<typeof PublicEnvironment>;

export function readPublicEnvironment(input: unknown): PublicEnvironment {
  return PublicEnvironment.parse(input);
}

export function publicEnvironment(): PublicEnvironment {
  const appEnv: unknown = process.env.EXPO_PUBLIC_APP_ENV;
  const apiBaseUrl: unknown = process.env.EXPO_PUBLIC_API_BASE_URL;
  const webBaseUrl: unknown = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  return readPublicEnvironment({
    appEnv,
    apiBaseUrl,
    webBaseUrl,
  });
}
