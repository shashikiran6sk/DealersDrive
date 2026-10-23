import { z } from 'zod';

export function normaliseDealerContact(value: string): string | null {
  const text = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(text)) return null;
  let digits = text.replace(/\D/g, '');
  if (digits.startsWith('0091')) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[1-9]\d{9}$/.test(digits)) return null;
  if (text.includes('+') && !text.startsWith('+91')) return null;
  return `+91${digits}`;
}

export const DealerContactInput = z
  .string()
  .trim()
  .max(24)
  .refine(
    (value) => value === '' || normaliseDealerContact(value) !== null,
    'Enter an Indian mobile number or landline with its STD code.',
  )
  .transform((value) => (value === '' ? null : normaliseDealerContact(value)))
  .nullable();

export const RevealDealerContact = z.object({
  phone: z.string(),
  phoneDisplay: z.string(),
  callHref: z.string(),
  dealerName: z.string(),
});
export type RevealDealerContact = z.infer<typeof RevealDealerContact>;

export const RevealContactInput = z.object({}).strict();
