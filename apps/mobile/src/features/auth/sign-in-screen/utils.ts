import { ApiError } from '../../../services/api';
import { AUTH_TEXT } from '../auth.constants';

const SIGN_IN_UNAVAILABLE_CODES: readonly string[] = [
  'NATIVE_AUTH_UNAVAILABLE',
  'LEGAL_PUBLICATION_NOT_READY',
];
const MISSING_ROUTE_STATUSES: readonly number[] = [401, 404, 405];

export function authFailureText(failure: unknown): string {
  if (!(failure instanceof ApiError))
    return failure instanceof Error ? failure.message : AUTH_TEXT.restoreError;
  if (
    SIGN_IN_UNAVAILABLE_CODES.includes(failure.code) ||
    (failure.status !== null && MISSING_ROUTE_STATUSES.includes(failure.status))
  )
    return AUTH_TEXT.signInUnavailable;
  if (failure.status === 429 && failure.retryAfterSeconds)
    return AUTH_TEXT.retryWait(failure.retryAfterSeconds);
  return failure.message;
}
