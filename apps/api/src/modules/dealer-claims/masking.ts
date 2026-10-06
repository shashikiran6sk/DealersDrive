export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const head = local.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

export function maskPhone(phone: string): string {
  const last4 = phone.slice(-4);
  return `+91 ••••• •${last4.slice(0, 1)}${last4.slice(1)}`;
}
