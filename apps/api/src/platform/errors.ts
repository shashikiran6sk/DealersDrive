/**
 * The error vocabulary of the whole API.
 *
 * Services throw these; the error handler is the only thing that turns them
 * into HTTP. A service that builds a response, sets a status code, or touches
 * `res` is doing the error handler's job (MVP-SCOPE §4.4 rule 1).
 */

/** Base for the RFC 9457 `type` URI. Each code gets a stable, documentable URL. */
export const PROBLEM_TYPE_BASE = 'https://dealersdrive.com/errors';

/** One invalid field. Mirrors the `errors[]` array in ARCHITECTURE §10.3. */
export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface AppErrorOptions {
  cause?: unknown;
  errors?: FieldError[];
}

export abstract class AppError extends Error {
  abstract readonly status: number;
  /** The machine-readable contract. The frontend switches on this, never on `detail`. */
  abstract readonly code: string;
  /** Short, human, stable across occurrences of the same code. */
  abstract readonly title: string;

  readonly errors?: FieldError[];

  constructor(detail: string, options?: AppErrorOptions) {
    super(detail, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    if (options?.errors) {
      this.errors = options.errors;
    }
    Error.captureStackTrace(this, new.target);
  }

  /** RFC 9457 calls it `detail`; Error calls it `message`. Same string. */
  get detail(): string {
    return this.message;
  }
}

/** 404 — the resource does not exist, or the caller may not know that it does. */
export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'NOT_FOUND';
  readonly title = 'Not found';

  constructor(detail = 'The requested resource does not exist.', options?: AppErrorOptions) {
    super(detail, options);
  }
}

/** 401 — no valid session. Used from Day 8. */
export class UnauthorizedError extends AppError {
  readonly status = 401;
  readonly code = 'UNAUTHORIZED';
  readonly title = 'Authentication required';

  constructor(detail = 'You must be signed in to do that.', options?: AppErrorOptions) {
    super(detail, options);
  }
}

/** 403 — authenticated, but not allowed. Also the answer to cross-tenant access. */
export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = 'FORBIDDEN';
  readonly title = 'Forbidden';

  constructor(detail = 'You do not have permission to do that.', options?: AppErrorOptions) {
    super(detail, options);
  }
}

/**
 * 422 — the request was well-formed and the caller was allowed, but a business
 * rule said no. The code travels with the error:
 *
 *   throw new DomainError('INSUFFICIENT_CREDITS', 'Publishing requires 1 credit; your balance is 0.');
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

/** `NOT_FOUND` -> `https://dealersdrive.com/errors/not-found` */
export function problemTypeFromCode(code: string): string {
  return `${PROBLEM_TYPE_BASE}/${code.toLowerCase().replaceAll('_', '-')}`;
}

/** `INSUFFICIENT_CREDITS` -> `Insufficient credits` */
export function titleFromCode(code: string): string {
  const words = code.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
