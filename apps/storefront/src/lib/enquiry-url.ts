import { StorefrontIntentParam } from '@dealers-drive/contracts';

export function verifiedEnquiryUrl(raw: string, centralBaseUrl: string): string {
  const url = new URL(raw);
  const central = new URL(centralBaseUrl);
  if (
    url.origin !== central.origin ||
    url.pathname !== '/website-enquiry' ||
    url.username ||
    url.password ||
    url.hash ||
    [...url.searchParams.keys()].some((key) => key !== 'ticket')
  )
    throw new Error('Invalid central enquiry URL.');
  StorefrontIntentParam.parse({ ticket: url.searchParams.get('ticket') });
  return url.toString();
}
