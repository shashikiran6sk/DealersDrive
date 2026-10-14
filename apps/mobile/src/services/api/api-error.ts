import type { ProblemDetails } from '@dealers-drive/contracts/common';

export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly code: string,
    message: string,
    readonly status: number | null = null,
    readonly problem?: ProblemDetails,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
