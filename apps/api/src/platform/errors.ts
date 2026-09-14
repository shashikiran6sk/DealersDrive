export const PROBLEM_TYPE_BASE = 'https://dealers-drive.com/errors';

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface AppErrorOptions {
  cause?: unknown;
  errors?: FieldError[];
  extra?: Record<string, unknown>;
}

export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
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

  get detail(): string {
    return this.message;
  }
}

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

export class ConfigurationError extends AppError {
  readonly status = 503;
  readonly code: string;
  readonly title = 'Not configured';

  constructor(detail: string, options?: AppErrorOptions & { code?: string }) {
    super(detail, options);
    this.code = options?.code ?? 'NOT_CONFIGURED';
  }
}

export class UpstreamUnavailableError extends AppError {
  readonly status = 503;
  readonly code: string;
  readonly title = 'Service unavailable';

  constructor(detail: string, options?: AppErrorOptions & { code?: string }) {
    super(detail, options);
    this.code = options?.code ?? 'UPSTREAM_UNAVAILABLE';
  }
}

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

export function problemTypeFromCode(code: string): string {
  return `${PROBLEM_TYPE_BASE}/${code.toLowerCase().replaceAll('_', '-')}`;
}

export function titleFromCode(code: string): string {
  const words = code.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function errorString(error: unknown, key: string): string | undefined {
  if (!isRecord(error)) return undefined;
  const value = error[key];
  return typeof value === 'string' ? value : undefined;
}

export function errorNumber(error: unknown, key: string): number | undefined {
  if (!isRecord(error)) return undefined;
  const value = error[key];
  return typeof value === 'number' ? value : undefined;
}

export function errorCode(error: unknown): string | undefined {
  return errorString(error, 'code');
}

export function awsStatusCode(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const metadata = error.$metadata;
  if (!isRecord(metadata)) return undefined;
  const status = metadata.httpStatusCode;
  return typeof status === 'number' ? status : undefined;
}
