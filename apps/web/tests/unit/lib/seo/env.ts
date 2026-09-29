import { vi } from 'vitest';

export const PRODUCTION_ORIGIN = 'https://www.dealers-drive.com';

export function production(origin = PRODUCTION_ORIGIN): void {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('WEB_BASE_URL', origin);
}
