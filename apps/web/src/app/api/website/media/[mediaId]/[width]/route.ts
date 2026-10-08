import { StorefrontMediaParam } from '@dealers-drive/contracts';
import { cookies } from 'next/headers';

import { SESSION_COOKIE } from '@/lib/api';
import { serverConfig } from '@/lib/config';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string; width: string }> },
) {
  const input = await params;
  const parsed = StorefrontMediaParam.safeParse({
    mediaId: input.mediaId,
    width: input.width.replace('.webp', ''),
  });
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!parsed.success || !session)
    return new Response('', { status: parsed.success ? 401 : 400, headers });
  try {
    const response = await fetch(
      `${serverConfig().apiBaseUrl}/v1/dealer/storefront/media/${parsed.data.mediaId}/${parsed.data.width}.webp`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
        headers: { Cookie: `${SESSION_COOKIE}=${session}` },
      },
    );
    if (!response.ok) return new Response('', { status: response.status, headers });
    const contentType = response.headers.get('content-type') ?? '';
    if (!/^image\/(webp|jpeg|png)(;|$)/.test(contentType))
      return new Response('', { status: 502, headers });
    return new Response(await response.arrayBuffer(), {
      headers: { ...headers, 'Content-Type': contentType },
    });
  } catch {
    return new Response('', { status: 503, headers });
  }
}
