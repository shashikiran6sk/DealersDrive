import { formatPhone } from '@dealers-drive/contracts';

const BARE_NUMBER = /^\+?[0-9]{10,13}$/;

export function phoneLabel(phone: string): string {
  return BARE_NUMBER.test(phone) ? formatPhone(phone) : phone;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[\s-]/g, '')}`;
}
