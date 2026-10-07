const VISIBLE_DIGITS = 4;

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= VISIBLE_DIGITS) return '•'.repeat(digits.length);
  return `${'•'.repeat(digits.length - VISIBLE_DIGITS)}${digits.slice(-VISIBLE_DIGITS)}`;
}

export function msisdnOf(phone: string): string {
  return phone.replace(/\D/g, '');
}
