import { describe, expect, it } from 'vitest';

import {
  AppError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  PROBLEM_TYPE_BASE,
  RateLimitError,
  UnauthorizedError,
  problemTypeFromCode,
  titleFromCode,
} from '../../../src/platform/errors.js';

/**
 * Unit tests for `src/platform/errors.ts`.
 *
 * These classes are the API's entire error vocabulary, and the error handler
 * reads four things off them — `status`, `code`, `title`, `detail`. Every one of
 * those is asserted here, including the defaults, because a wrong default is
 * invisible in code review and arrives at a client as the wrong status.
 */
describe('AppError', () => {
  it('exposes the RFC 9457 `detail` as an alias of Error#message', () => {
    const error = new NotFoundError('That car has been sold.');

    expect(error.detail).toBe('That car has been sold.');
    expect(error.message).toBe(error.detail);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('names itself after the concrete subclass, not after AppError', () => {
    // The name reaches logs. `Error: …` for a 404 would send a reader hunting
    // for a bug that is not there.
    expect(new NotFoundError().name).toBe('NotFoundError');
    expect(new DomainError('X', 'y').name).toBe('DomainError');
  });

  it('carries field errors only when given them', () => {
    const withFields = new DomainError('VALIDATION', 'Bad price', {
      errors: [{ field: 'pricePaise', code: 'TOO_LOW', message: 'Minimum is ₹10,000.' }],
    });

    expect(withFields.errors).toHaveLength(1);
    expect(withFields.errors?.[0]?.field).toBe('pricePaise');
    // Absent rather than empty: the error handler omits the key entirely, and
    // `errors: []` in a problem body would suggest a lookup found nothing.
    expect(new DomainError('X', 'y').errors).toBeUndefined();
  });

  it('carries the spec-mandated extra keys only when given them', () => {
    const error = new DomainError('INSUFFICIENT_CREDITS', 'Need 1 credit', {
      extra: { balance: 0, required: 1 },
    });

    expect(error.extra).toEqual({ balance: 0, required: 1 });
    expect(new DomainError('X', 'y').extra).toBeUndefined();
  });

  it('preserves a cause without leaking it into the message', () => {
    const cause = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    const error = new NotFoundError('Not found.', { cause });

    expect(error.cause).toBe(cause);
    expect(error.message).not.toContain('ECONNREFUSED');
    expect(new NotFoundError('Not found.').cause).toBeUndefined();
  });

  it('trims its own constructor out of the stack', () => {
    const error = new ForbiddenError();

    expect(error.stack).toBeDefined();
    expect(error.stack?.split('\n')[1]).not.toContain('new ForbiddenError');
  });
});

describe('each status class', () => {
  it('maps to the status and default code the spec fixes', () => {
    const cases: [AppError, number, string, string][] = [
      [new NotFoundError(), 404, 'NOT_FOUND', 'Not found'],
      [new UnauthorizedError(), 401, 'NOT_AUTHENTICATED', 'Authentication required'],
      [new ForbiddenError(), 403, 'FORBIDDEN', 'Forbidden'],
      [new RateLimitError('Slow down.', 30), 429, 'RATE_LIMITED', 'Too many requests'],
    ];

    for (const [error, status, code, title] of cases) {
      expect(error.status).toBe(status);
      expect(error.code).toBe(code);
      expect(error.title).toBe(title);
      expect(error.detail.length).toBeGreaterThan(0);
    }
  });

  it('lets a caller override the default code without changing the status', () => {
    // C11 `DEALER_NOT_ACTIVE` is a 403; A9 `LISTING_GONE` is a 404. The status
    // is a property of the class, the code is a property of the situation.
    const suspended = new ForbiddenError('Not active yet.', { code: 'DEALER_NOT_ACTIVE' });
    const gone = new NotFoundError('That listing has gone.', { code: 'LISTING_GONE' });
    const noSession = new UnauthorizedError('Session expired.', { code: 'SESSION_EXPIRED' });

    expect([suspended.status, suspended.code]).toEqual([403, 'DEALER_NOT_ACTIVE']);
    expect([gone.status, gone.code]).toEqual([404, 'LISTING_GONE']);
    expect([noSession.status, noSession.code]).toEqual([401, 'SESSION_EXPIRED']);
  });

  it('requires the code on ConflictError and DomainError, and derives the title', () => {
    const conflict = new ConflictError('ALREADY_APPROVED', 'Another moderator got there first.');
    const domain = new DomainError('INSUFFICIENT_CREDITS', 'Publishing needs 1 credit.');

    expect([conflict.status, conflict.title]).toEqual([409, 'Already approved']);
    expect([domain.status, domain.title]).toEqual([422, 'Insufficient credits']);
  });

  it('lets a caller supply a better title than the derived one', () => {
    const conflict = new ConflictError('ALREADY_APPROVED', 'Too late.', {
      title: 'Already reviewed',
    });
    const domain = new DomainError('TOO_FEW_PHOTOS', 'Add three photos.', {
      title: 'Not enough photos',
    });

    expect(conflict.title).toBe('Already reviewed');
    expect(domain.title).toBe('Not enough photos');
  });

  it('keeps `Retry-After` on the rate-limit error rather than in the message', () => {
    const error = new RateLimitError('Five an hour from one network.', 1_800, {
      code: 'ENQUIRY_RATE_LIMITED',
    });

    expect(error.retryAfterSeconds).toBe(1_800);
    expect(error.code).toBe('ENQUIRY_RATE_LIMITED');
  });
});

describe('problemTypeFromCode', () => {
  it('builds a stable, documentable URL per code', () => {
    expect(problemTypeFromCode('NOT_FOUND')).toBe(`${PROBLEM_TYPE_BASE}/not-found`);
    expect(problemTypeFromCode('INSUFFICIENT_CREDITS')).toBe(
      `${PROBLEM_TYPE_BASE}/insufficient-credits`,
    );
  });

  it('replaces every underscore, not just the first', () => {
    expect(problemTypeFromCode('ONE_TWO_THREE')).toBe(`${PROBLEM_TYPE_BASE}/one-two-three`);
  });
});

describe('titleFromCode', () => {
  it('sentence-cases the code', () => {
    expect(titleFromCode('NOT_FOUND')).toBe('Not found');
    expect(titleFromCode('TOO_FEW_PHOTOS')).toBe('Too few photos');
  });

  it('handles a single word and an empty string without throwing', () => {
    expect(titleFromCode('CONFLICT')).toBe('Conflict');
    expect(titleFromCode('')).toBe('');
  });
});
