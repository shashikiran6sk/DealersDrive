import { PROBLEM_TYPE_BASE } from '../platform/errors.js';
import type { JsonSchema } from './schemas.js';

/**
 * The error half of the contract, written once.
 *
 * Every failure this API can produce is an RFC 9457 problem document with
 * `application/problem+json` — there is no second error shape (§23), so there is
 * no reason for 73 operations to describe one each. These become
 * `components.responses`, and each operation lists the statuses it can actually
 * return.
 *
 * The status → code mapping is not invented here; it is what the error classes
 * in `platform/errors.ts` declare:
 *
 *   ZodError           → 400 VALIDATION_FAILED   (with `errors[]` per field)
 *   body-parser        → 400 MALFORMED_BODY / 413 / 415
 *   UnauthorizedError  → 401 NOT_AUTHENTICATED
 *   ForbiddenError     → 403 FORBIDDEN | DEALER_NOT_ACTIVE
 *   NotFoundError      → 404 NOT_FOUND
 *   ConflictError      → 409 <code>
 *   DomainError        → 422 <code>
 *   RateLimitError     → 429 RATE_LIMITED        (+ Retry-After)
 *   anything else      → 500 INTERNAL
 */

const PROBLEM_REF: JsonSchema = { $ref: '#/components/schemas/ProblemDetails' };

function problem(status: number, code: string, detail: string, extra?: JsonSchema): JsonSchema {
  return {
    type: `${PROBLEM_TYPE_BASE}/${code.toLowerCase().replaceAll('_', '-')}`,
    title: code
      .toLowerCase()
      .replaceAll('_', ' ')
      .replace(/^./, (letter) => letter.toUpperCase()),
    status,
    code,
    traceId: 'a1b2c3d4e5',
    detail,
    ...extra,
  };
}

interface ProblemResponse {
  description: string;
  content: Record<
    string,
    { schema: JsonSchema; examples?: Record<string, { summary: string; value: unknown }> }
  >;
  headers?: Record<string, { description: string; schema: JsonSchema }>;
}

function response(
  description: string,
  examples: Record<string, { summary: string; value: unknown }>,
  headers?: ProblemResponse['headers'],
): ProblemResponse {
  return {
    description,
    content: { 'application/problem+json': { schema: PROBLEM_REF, examples } },
    ...(headers ? { headers } : {}),
  };
}

/**
 * Keyed by the name an operation references: `$ref: '#/components/responses/…'`.
 */
export const ERROR_RESPONSES: Record<string, ProblemResponse> = {
  BadRequest: response(
    'The request did not match the schema. Every input schema is `.strict()`, so an ' +
      'unknown field is a 400 rather than a silent ignore — the response names the field.',
    {
      validationFailed: {
        summary: 'A field failed validation',
        value: problem(400, 'VALIDATION_FAILED', 'The request did not match the expected shape.', {
          errors: [
            {
              field: 'body.pricePaise',
              code: 'INVALID_TYPE',
              message: 'Expected int, received number',
            },
          ],
        }),
      },
      unrecognizedKey: {
        summary: 'An unknown field or query parameter',
        value: problem(400, 'VALIDATION_FAILED', 'The request did not match the expected shape.', {
          errors: [
            {
              field: 'query.colour',
              code: 'UNRECOGNIZED_KEY',
              message: '`colour` is not a recognised field.',
            },
          ],
        }),
      },
      malformedBody: {
        summary: 'The body is not valid JSON',
        value: problem(400, 'MALFORMED_BODY', 'The request body is not valid JSON.'),
      },
    },
  ),

  Unauthorized: response('No session could be resolved for this request.', {
    notAuthenticated: {
      summary: 'No dealer session',
      value: problem(
        401,
        'NOT_AUTHENTICATED',
        'No dealer session. Seed the database with `pnpm db:seed` so the development dealer exists.',
      ),
    },
  }),

  Forbidden: response(
    'The caller was identified but is not allowed to do this — either the seat lacks the ' +
      'permission (§8.3) or the dealership is not ACTIVE.',
    {
      forbidden: {
        summary: 'The seat lacks the permission',
        value: problem(403, 'FORBIDDEN', 'This action needs the billing:purchase permission.'),
      },
      dealerNotActive: {
        summary: 'The dealership is not active',
        value: problem(
          403,
          'DEALER_NOT_ACTIVE',
          'Your dealership is not active yet. Listings can be published once our team approves it.',
        ),
      },
    },
  ),

  NotFound: response(
    'The resource does not exist — **or belongs to another dealer**. A cross-tenant read ' +
      'answers 404, never 403: a 403 would confirm the id is real and hand a competitor an ' +
      'enumeration oracle (§7).',
    {
      notFound: {
        summary: 'Unknown, or not yours',
        value: problem(404, 'NOT_FOUND', 'That vehicle does not exist.'),
      },
    },
  ),

  Conflict: response('The request collides with the current state of the resource.', {
    invalidTransition: {
      summary: 'The listing state machine refused the move',
      value: problem(409, 'INVALID_TRANSITION', 'This listing is approved and cannot be approved.'),
    },
    alreadySubmitted: {
      summary: 'The vehicle already has a live listing',
      value: problem(409, 'ALREADY_SUBMITTED', 'This vehicle already has a live listing.'),
    },
  }),

  UnprocessableEntity: response(
    'The request was well-formed and the caller was allowed, but a business rule said no. ' +
      '`code` identifies which one.',
    {
      insufficientCredits: {
        summary: 'Not enough listing credits',
        value: problem(
          422,
          'INSUFFICIENT_CREDITS',
          'Publishing this vehicle needs 1 credit. Your balance is 0.',
          { creditBalance: 0, actionLabel: 'Buy credits', actionHref: '/dealer/billing' },
        ),
      },
      tooFewPhotos: {
        summary: 'The listing does not have enough photos yet',
        value: problem(422, 'TOO_FEW_PHOTOS', 'Add 2 more photos (6 required).', {
          errors: [
            { field: 'photos', code: 'TOO_FEW', message: 'Add 2 more photos (6 required).' },
          ],
        }),
      },
      vehicleIncomplete: {
        summary: 'Required vehicle details are missing',
        value: problem(422, 'VEHICLE_INCOMPLETE', 'This vehicle is missing some details.', {
          errors: [
            { field: 'kmDriven', code: 'REQUIRED', message: 'Kilometres driven is required.' },
          ],
        }),
      },
    },
  ),

  TooManyRequests: response(
    'Over a rate limit. Always accompanied by `Retry-After`.',
    {
      rateLimited: {
        summary: 'Too many enquiries from one network',
        value: problem(
          429,
          'RATE_LIMITED',
          'Too many enquiries from this network. Try again in an hour.',
        ),
      },
    },
    {
      'Retry-After': {
        description: 'Seconds to wait before retrying.',
        schema: { type: 'integer', example: 3600 },
      },
    },
  ),

  InternalServerError: response(
    'An unhandled failure. `traceId` is the only thing worth quoting in a support ticket — ' +
      'the response never carries a stack trace or an internal message in production.',
    {
      internal: {
        summary: 'Unhandled error',
        value: problem(500, 'INTERNAL', 'An unexpected error occurred.'),
      },
    },
  ),

  ServiceUnavailable: response(
    'A credential this operation needs is not configured on the server. Nothing about ' +
      'the request is wrong; the deployment is incomplete.',
    {
      oauthNotConfigured: {
        summary: 'Google sign-in is not configured',
        value: problem(
          503,
          'OAUTH_NOT_CONFIGURED',
          'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
        ),
      },
    },
  ),
};

/** Status → the `components.responses` key that documents it. */
export const ERROR_RESPONSE_BY_STATUS: Record<number, string> = {
  400: 'BadRequest',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'NotFound',
  409: 'Conflict',
  422: 'UnprocessableEntity',
  429: 'TooManyRequests',
  500: 'InternalServerError',
  503: 'ServiceUnavailable',
};
