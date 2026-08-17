import { NextResponse } from 'next/server';

import { serverConfig } from '@/lib/config';

/**
 * Streams a GST invoice PDF from the API (C19).
 *
 * The browser cannot fetch it directly — the API base URL is server-side only
 * (Rule 9) — and the file must not be public: it carries a dealer's billing
 * details. So it is proxied here, and the API still resolves the owning dealer
 * from the session, meaning another dealer's invoice id 404s upstream rather
 * than being served by this handler.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const upstream = await fetch(
    `${serverConfig().apiBaseUrl}/v1/dealer/billing/invoices/${encodeURIComponent(id)}/pdf`,
    { cache: 'no-store' },
  );

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Invoice not available.' }, { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
