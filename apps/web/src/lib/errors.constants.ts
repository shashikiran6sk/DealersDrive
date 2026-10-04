import type { ErrorCategory } from './errors';

export const ERROR_TEXT = {
  byCategory: {
    RESOURCE_NOT_FOUND: 'We couldn’t find what you were looking for.',
    UNAUTHORIZED: 'Please sign in to continue.',
    FORBIDDEN: 'You don’t have access to this.',
    VALIDATION: 'Please check the details and try again.',
    CONFLICT: 'That couldn’t be done right now. Please refresh and try again.',
    RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
    SERVICE_UNAVAILABLE: 'This service is temporarily unavailable. Please try again.',
    INTERNAL_ERROR: 'Something went wrong. Please try again.',
  } satisfies Record<ErrorCategory, string>,
} as const;
