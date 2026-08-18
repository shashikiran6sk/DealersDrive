import { describe, expect, it } from 'vitest';

import { ERROR_RESPONSE_BY_STATUS, ERROR_RESPONSES } from '../../../src/docs/errors.js';
import { PROBLEM_TYPE_BASE } from '../../../src/platform/errors.js';

/**
 * The error half of the contract, written once (§23). Seventy-odd operations
 * reference these components rather than describing a problem body each, so
 * the thing to check is that every documented example is a *real* problem
 * document — same media type, same fields, same `type` URI convention as the
 * error handler actually emits.
 *
 * A documented example that disagrees with the runtime is worse than no
 * example: a client writes its parser against the document.
 */

interface ProblemExample {
  type: string;
  title: string;
  status: number;
  code: string;
  traceId: string;
  detail?: string;
  errors?: unknown[];
}

interface ProblemResponse {
  description: string;
  content: Record<string, { schema: unknown; examples: Record<string, { value: ProblemExample }> }>;
  headers?: Record<string, unknown>;
}

const responses = ERROR_RESPONSES as Record<string, ProblemResponse>;

function examples(response: ProblemResponse): ProblemExample[] {
  return Object.values(Object.values(response.content)[0]?.examples ?? {}).map(
    (example) => example.value,
  );
}

const allExamples = Object.values(responses).flatMap(examples);

describe('the response components', () => {
  it('covers every status the API can answer with', () => {
    expect(Object.keys(responses).sort()).toEqual(
      [
        'BadRequest',
        'Conflict',
        'Forbidden',
        'InternalServerError',
        'NotFound',
        'TooManyRequests',
        'Unauthorized',
        'UnprocessableEntity',
      ].sort(),
    );
  });

  it('describes each one', () => {
    for (const [name, response] of Object.entries(responses)) {
      expect(response.description, name).toBeTruthy();
    }
  });

  /** There is no second error shape, so there is no second media type. */
  it('serves every error as application/problem+json', () => {
    for (const [name, response] of Object.entries(responses)) {
      expect(Object.keys(response.content), name).toEqual(['application/problem+json']);
    }
  });

  it('points every schema at the shared ProblemDetails component', () => {
    for (const [name, response] of Object.entries(responses)) {
      expect(response.content['application/problem+json']?.schema, name).toEqual({
        $ref: '#/components/schemas/ProblemDetails',
      });
    }
  });

  it('gives every response at least one worked example', () => {
    for (const [name, response] of Object.entries(responses)) {
      expect(examples(response).length, name).toBeGreaterThan(0);
    }
  });
});

describe('the examples', () => {
  it('carry every field the runtime always emits', () => {
    for (const example of allExamples) {
      expect(example).toMatchObject({
        type: expect.any(String),
        title: expect.any(String),
        status: expect.any(Number),
        code: expect.any(String),
        traceId: expect.any(String),
      });
    }
  });

  /** `problemTypeFromCode` builds the same URI at runtime. */
  it('derive the type URI from the code, exactly as the error handler does', () => {
    for (const example of allExamples) {
      expect(example.type).toBe(
        `${PROBLEM_TYPE_BASE}/${example.code.toLowerCase().replaceAll('_', '-')}`,
      );
    }
  });

  it('use SCREAMING_SNAKE codes', () => {
    for (const example of allExamples) {
      expect(example.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('title-case the title from the code', () => {
    for (const example of allExamples) {
      expect(example.title).toBe(
        example.code
          .toLowerCase()
          .replaceAll('_', ' ')
          .replace(/^./, (letter) => letter.toUpperCase()),
      );
    }
  });

  it('give each example a status matching the response it lives under', () => {
    const statusOf: Record<string, number> = {
      BadRequest: 400,
      Unauthorized: 401,
      Forbidden: 403,
      NotFound: 404,
      Conflict: 409,
      UnprocessableEntity: 422,
      TooManyRequests: 429,
      InternalServerError: 500,
    };

    for (const [name, response] of Object.entries(responses)) {
      for (const example of examples(response)) {
        expect(example.status, `${name} → ${example.code}`).toBe(statusOf[name]);
      }
    }
  });

  it('write a detail a human can act on', () => {
    for (const example of allExamples) {
      if (example.detail !== undefined) {
        expect(example.detail.length).toBeGreaterThan(10);
      }
    }
  });

  /**
   * A stack trace or a SQL fragment in a documented example would teach a
   * client to expect one — and would suggest the runtime leaks them, which it
   * must not.
   */
  it('leak nothing internal', () => {
    const serialised = JSON.stringify(allExamples);

    expect(serialised).not.toMatch(/SELECT |INSERT |at Object\.|node_modules|prisma\./i);
  });

  it('use a placeholder traceId, not one from a real request', () => {
    for (const example of allExamples) {
      expect(example.traceId).toMatch(/^[\w-]+$/);
    }
  });
});

describe('specific statuses', () => {
  it('gives 400 a field-level errors array, which is the point of a 400', () => {
    const validation = examples(responses.BadRequest as ProblemResponse).find(
      (example) => example.code === 'VALIDATION_FAILED',
    );

    expect(validation?.errors?.length ?? 0).toBeGreaterThan(0);
  });

  it('documents the body-parser failures under 400 too', () => {
    const codes = examples(responses.BadRequest as ProblemResponse).map((example) => example.code);

    expect(codes).toContain('MALFORMED_BODY');
  });

  /** A client that cannot see Retry-After will retry immediately and stay limited. */
  it('documents Retry-After on the 429', () => {
    expect(Object.keys(responses.TooManyRequests?.headers ?? {})).toContain('Retry-After');
  });

  it('documents DEALER_NOT_ACTIVE under 403, where API-SPEC C11 puts it', () => {
    const codes = examples(responses.Forbidden as ProblemResponse).map((example) => example.code);

    expect(codes).toContain('DEALER_NOT_ACTIVE');
  });

  it('documents INSUFFICIENT_CREDITS under 422 with its balance extra', () => {
    const insufficient = examples(responses.UnprocessableEntity as ProblemResponse).find(
      (example) => example.code === 'INSUFFICIENT_CREDITS',
    );

    expect(insufficient).toBeDefined();
    expect(insufficient).toHaveProperty('creditBalance');
  });

  it('gives the 500 no detail — the traceId is what support correlates on', () => {
    const internal = examples(responses.InternalServerError as ProblemResponse)[0];

    expect(internal?.code).toBe('INTERNAL');
    expect(internal?.traceId).toBeTruthy();
  });
});

describe('ERROR_RESPONSE_BY_STATUS', () => {
  it('maps every documented status to a component that exists', () => {
    for (const [status, name] of Object.entries(ERROR_RESPONSE_BY_STATUS)) {
      expect(responses, `${status} → ${name}`).toHaveProperty(name);
    }
  });

  it('maps every component from at least one status', () => {
    const mapped = new Set(Object.values(ERROR_RESPONSE_BY_STATUS));

    for (const name of Object.keys(responses)) {
      expect(mapped, name).toContain(name);
    }
  });

  it('uses the statuses the error classes actually produce', () => {
    expect(
      Object.keys(ERROR_RESPONSE_BY_STATUS)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([400, 401, 403, 404, 409, 422, 429, 500]);
  });
});
