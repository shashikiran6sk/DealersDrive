import { z } from 'zod';

export const DEALER_TAGLINE_MAX = 200;
export const DealerTaglineInput = z
  .string()
  .trim()
  .max(DEALER_TAGLINE_MAX, 'Keep it to one line — 200 characters at most.')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();
