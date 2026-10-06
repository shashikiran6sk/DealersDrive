import { ApiError, UpstreamUnavailableError } from './api';
import { ERROR_TEXT } from './errors.constants';

export type ErrorCategory =
  | 'RESOURCE_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

const UNAVAILABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

export function categoryOf(error: unknown): ErrorCategory {
  if (error instanceof UpstreamUnavailableError) return 'SERVICE_UNAVAILABLE';
  if (!(error instanceof ApiError)) return 'INTERNAL_ERROR';

  const { status } = error;
  if (status === 404) return 'RESOURCE_NOT_FOUND';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (UNAVAILABLE_STATUSES.has(status)) return 'SERVICE_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'VALIDATION';
}

export interface MissingResourceOptions {
  invalidIdentifier?: boolean;
}

export function isMissingResource(error: unknown, options: MissingResourceOptions = {}): boolean {
  if (categoryOf(error) === 'RESOURCE_NOT_FOUND') return true;
  return Boolean(options.invalidIdentifier) && error instanceof ApiError && error.status === 400;
}

export function isServerFailure(error: unknown): boolean {
  const category = categoryOf(error);
  return category === 'SERVICE_UNAVAILABLE' || category === 'INTERNAL_ERROR';
}

export function safeMessage(error: unknown): string {
  return ERROR_TEXT.byCategory[categoryOf(error)];
}
