import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type * as envModule from '../../../../src/config/env.js';
import {
  legalRightsReleased,
  requireLegalRelease,
} from '../../../../src/modules/legal/legal-release.js';
import { DomainError } from '../../../../src/platform/errors.js';

const setting = vi.hoisted(() => ({ appEnv: 'local' }));
vi.mock('../../../../src/config/env.js', async (original) => {
  const actual = await original<typeof envModule>();
  return {
    ...actual,
    env: {
      ...actual.env,
      get APP_ENV() {
        return setting.appEnv;
      },
    },
  };
});

function run(): unknown {
  const next = vi.fn();
  requireLegalRelease({} as Request, {} as Response, next as NextFunction);
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0]?.[0];
}

describe('legal release lock for customer withdrawal controls', () => {
  it('keeps unapproved withdrawal controls closed in production', () => {
    setting.appEnv = 'production';
    expect(legalRightsReleased()).toBe(false);
    const error = run();
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: 'LEGAL_NOT_ACTIVE', status: 422 });
  });

  it.each(['local', 'preview', 'dev'])('allows review in %s', (appEnv) => {
    setting.appEnv = appEnv;
    expect(legalRightsReleased()).toBe(true);
    expect(run()).toBeUndefined();
  });
});
