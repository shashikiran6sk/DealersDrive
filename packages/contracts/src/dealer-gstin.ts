import { z } from 'zod';

export const GstinValue = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
    'Enter a valid 15-character GSTIN, or leave it blank if not applicable.',
  );

export const OptionalGstin = z.preprocess((value) => {
  if (value === null || (typeof value === 'string' && value.trim() === '')) return null;
  return value;
}, GstinValue.nullable().optional());
