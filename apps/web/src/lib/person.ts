const NAME_PART = /[^\p{L}]/gu;

export function personInitials(fullName: string): string {
  const words = fullName
    .split(/\s+/)
    .map((word) => word.replace(NAME_PART, ''))
    .filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase('en-IN') || '?';
}

export function maskIndianMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const national = digits.length > 10 ? digits.slice(-10) : digits;
  if (national.length !== 10) return phone;
  return `+91 ${national.slice(0, 2)}XXXXXX${national.slice(-2)}`;
}
