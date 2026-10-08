import { StorefrontIntentResponse } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { StorefrontApiError, storefrontRequest } from '@/lib/api';
import { verifiedEnquiryUrl } from '@/lib/enquiry-url';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const intent = await storefrontRequest(StorefrontIntentResponse, '/enquiry-intent', {
      listingSlug: slug,
    });
    return NextResponse.redirect(
      verifiedEnquiryUrl(intent.url, process.env.WEB_BASE_URL ?? 'http://localhost:3000'),
      {
        status: 303,
        headers: {
          'Cache-Control': 'private, no-store',
          'Referrer-Policy': 'no-referrer',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      },
    );
  } catch (error) {
    const status = error instanceof StorefrontApiError ? error.status : 503;
    return new Response(
      'This car or enquiry service is currently unavailable. Return to the inventory and try again.',
      {
        status,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      },
    );
  }
}
