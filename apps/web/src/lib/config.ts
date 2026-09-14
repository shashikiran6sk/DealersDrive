import 'server-only';

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

export interface ClientConfig {
  appEnv: ServerConfig['appEnv'];
  supportPhone: string;
  supportEmail: string;
  minPhotosPerListing: number;
  listingDurationDays: number;
}
