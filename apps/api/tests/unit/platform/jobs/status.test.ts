import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { backgroundStatus } from '../../../../src/platform/jobs/status.js';

describe('background metrics', () => {
  it('reports pending age and parked failures without exposing job payloads', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ depth: 2, age: 31, failed: 1 }])
      .mockResolvedValueOnce([{ age: 65, failed: 3 }]);
    const prisma = { $queryRaw: query } as unknown as PrismaClient;
    expect(await backgroundStatus(prisma)).toEqual({
      QueueDepth: 2,
      QueueAgeSeconds: 31,
      FailedJobs: 4,
      OutboxAgeSeconds: 65,
    });
  });
  it('reports zero for empty result sets', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as PrismaClient;
    expect(await backgroundStatus(prisma)).toEqual({
      QueueDepth: 0,
      QueueAgeSeconds: 0,
      FailedJobs: 0,
      OutboxAgeSeconds: 0,
    });
  });
});
