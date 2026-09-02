/**
 * The error vocabulary of the whole API.
 *
 * Services throw these; the error handler is the only thing that turns them
 * into HTTP. A service that builds a response, sets a status code, or touches
 * `res` is doing the error handler's job.
 */

/** Base for the RFC 9457 `type` URI. Each code gets a stable, documentable URL. */
export const PROBLEM_TYPE_BASE = 'https://dealers-drive.com/errors';

/** One invalid field. Mirrors the `errors[]` array in API-SPEC §0.2. */
export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface AppErrorOptions {
  cause?: unknown;
  errors?: FieldError[];
  /** Extra top-level keys the spec puts in a specific problem body. */
  extra?: Record<string, unknown>;
}

export abstract class AppError extends Error {
  abstract readonly status: number;
  /** The machine-readable contract. The frontend switches on this, never on `detail`. */
  abstract readonly code: string;
  /** Short, human, stable across occurrences of the same code. */
  abstract readonly title: string;

  readonly errors?: FieldError[];
  readonly extra?: Record<string, unknown>;

  constructor(detail: string, options?: AppErrorOptions) {
    super(detail, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    if (options?.errors) {
      this.errors = options.errors;
    }
    if (options?.extra) {
      this.extra = options.extra;
    }
    Error.captureStackTrace(this, new.target);
  }

  /** RFC 9457 calls it `detail`; Error calls it `message`. Same string. */
  get detail(): string {
    return this.message;
  }
}

/**
 * 404 — the resource does not exist, or the caller may not know that it does.
 * Cross-tenant access answers 404, never 403, so existence is not leaked (§7).
 */
export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code: string;
  readonly title = 'Not found';

  constructor(
    detail = 'The requested resource does not exist.',
    options?: AppErrorOptions & { code?: string },
  ) {
    super(detail, options);
    this.code = options?.code ?? 'NOT_FOUND';
  }
}

/** 401 — no valid session. */
export class UnauthorizedError extends AppError {
  readonly status = 401;
  readonly code: string;
  readonly title = 'Authentication required';

  constructor(
    detail = 'You must be signed in to do that.',
    options?: AppErrorOptions & { code?: string },
  ) {
    super(detail, options);
    this.code = options?.code ?? 'NOT_AUTHENTICATED';
  }
}

/** 403 — authenticated, but not allowed. */
export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code: string;
  readonly title = 'Forbidden';

  constructor(
    detail = 'You do not have permission to do that.',
    options?: AppErrorOptions & { code?: string },
  ) {
    super(detail, options);
    this.code = options?.code ?? 'FORBIDDEN';
  }
}

/**
 * 409 — the request collides with the current state. Two moderators opening
 * the same card is expected; the second one gets a clear error rather than a
 * double approval.
 */
export class ConflictError extends AppError {
  readonly status = 409;
  readonly code: string;
  readonly title: string;

  constructor(code: string, detail: string, options?: AppErrorOptions & { title?: string }) {
    super(detail, options);
    this.code = code;
    this.title = options?.title ?? titleFromCode(code);
  }
}

/**
 * 422 — the request was well-formed and the caller was allowed, but a business
 * rule said no. The code travels with the error:
 *
 *   throw new DomainError('INSUFFICIENT_CREDITS', 'Publishing needs 1 credit; your balance is 0.');
 */
export class DomainError extends AppError {
  readonly status = 422;
  readonly code: string;
  readonly title: string;

  constructor(code: string, detail: string, options?: AppErrorOptions & { title?: string }) {
    super(detail, options);
    this.code = code;
    this.title = options?.title ?? titleFromCode(code);
  }
}

/**
 * 503 — the API is configured such that it cannot perform this operation.
 *
 * Not the caller's fault and not a business rule: a credential is missing. The
 * detail is written for the developer who has to fix it and names the variable,
 * because the alternative — a generic 500 — sends them to the logs to learn
 * something the response could have told them (§29).
 */
export class ConfigurationError extends AppError {
  readonly status = 503;
  readonly code: string;
  readonly title = 'Not configured';

  constructor(detail: string, options?: AppErrorOptions & { code?: string }) {
    super(detail, options);
    this.code = options?.code ?? 'NOT_CONFIGURED';
  }
}

/**
 * 503 — a dependency we do not control is not answering.
 *
 * Distinct from `ConfigurationError`, which is also 503: that one means *we*
 * are set up wrong and a developer must fix it. This one means someone else's
 * service is down and the right response is to try later or take another path.
 * Conflating them sends an operator hunting for a missing credential during a
 * vendor outage.
 */
export class UpstreamUnavailableError extends AppError {
  readonly status = 503;
  readonly code: string;
  readonly title = 'Service unavailable';

  constructor(detail: string, options?: AppErrorOptions & { code?: string }) {
    super(detail, options);
    this.code = options?.code ?? 'UPSTREAM_UNAVAILABLE';
  }
}

/** 429 — over a limit. Always accompanied by `Retry-After`. */
export class RateLimitError extends AppError {
  readonly status = 429;
  readonly code: string;
  readonly title = 'Too many requests';
  readonly retryAfterSeconds: number;

  constructor(
    detail: string,
    retryAfterSeconds: number,
    options?: AppErrorOptions & { code?: string },
  ) {
    super(detail, options);
    this.code = options?.code ?? 'RATE_LIMITED';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** `NOT_FOUND` -> `https://dealers-drive.com/errors/not-found` */
export function problemTypeFromCode(code: string): string {
  return `${PROBLEM_TYPE_BASE}/${code.toLowerCase().replaceAll('_', '-')}`;
}

/** `INSUFFICIENT_CREDITS` -> `Insufficient credits` */
export function titleFromCode(code: string): string {
  const words = code.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
