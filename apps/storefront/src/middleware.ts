import { NextResponse, type NextRequest } from 'next/server';
import { PublicStorefrontDto } from '@dealers-drive/contracts';
import { primaryUrl, requestHostname } from './lib/hostname';

export async function middleware(request: NextRequest) {
  const failure = (status: number) =>
    new NextResponse(
      status === 404
        ? 'This dealership website is unavailable.'
        : 'The dealership website is temporarily unavailable. Please try again.',
      {
        status,
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
          'Content-Type': 'text/plain; charset=utf-8',
          ...(status === 503 ? { 'Retry-After': '60' } : {}),
        },
      },
    );
  let hostname: string;
  try {
    hostname = requestHostname(
      request.headers.get('host'),
      process.env.STOREFRONT_DEV_HOSTNAME,
      process.env.NODE_ENV === 'production',
    );
  } catch {
    return failure(404);
  }
  const secret = process.env.STOREFRONT_SERVICE_SECRET;
  if (!secret) return failure(503);
  const ipSecret = process.env.CLIENT_IP_FORWARD_SECRET;
  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  try {
    const response = await fetch(
      `${process.env.API_BASE_URL ?? 'http://localhost:4000'}/v1/storefront/site`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
        headers: {
          'x-dd-storefront-host': hostname,
          'x-dd-storefront-secret': secret,
          'x-request-id': crypto.randomUUID(),
          ...(ipSecret && ip ? { 'x-dd-forward-secret': ipSecret, 'x-dd-client-ip': ip } : {}),
        },
      },
    );
    if (!response.ok) return failure(response.status === 404 ? 404 : 503);
    const site = PublicStorefrontDto.safeParse(await response.json());
    if (!site.success || site.data.requestedHostname !== hostname) return failure(503);
    if (site.data.primaryHostname !== hostname)
      return NextResponse.redirect(
        primaryUrl(site.data.primaryHostname, request.nextUrl.pathname, request.nextUrl.search),
        308,
      );
  } catch {
    return failure(503);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-dd-storefront-secret');
  requestHeaders.delete('x-dd-storefront-host');
  requestHeaders.set('x-dd-pathname', request.nextUrl.pathname);
  requestHeaders.set('x-dd-search', request.nextUrl.search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
