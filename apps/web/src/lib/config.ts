import 'server-only';

/**
 * Runtime configuration, read on the server.
 *
 * `NEXT_PUBLIC_*` is banned (ARCHITECTURE §15.3, Rule 9): those variables are
 * inlined at build time, which would force one image per environment and break
 * build-once-promote-many. Anything the browser needs is read here, in a server
 * component, and passed down as props — see `ConfigProvider` in the root
 * layout.
 */
export interface ServerConfig {
  apiBaseUrl: string;
  webBaseUrl: string;
  appEnv: 'local' | 'preview' | 'dev' | 'production';
}

export function serverConfig(): ServerConfig {
  return {
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
    webBaseUrl: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
    appEnv: (process.env.APP_ENV as ServerConfig['appEnv']) ?? 'local',
  };
}

/** The subset that is safe, and useful, in the browser. */
export interface ClientConfig {
  appEnv: ServerConfig['appEnv'];
  supportPhone: string;
  supportEmail: string;
  minPhotosPerListing: number;
  listingDurationDays: number;
}
