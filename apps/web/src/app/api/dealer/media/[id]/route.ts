import {
  MediaCommitInput,
  type MediaCommitResponse,
  type VehicleMediaDto,
} from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiGet, apiSend } from '@/lib/api';

/**
 * BFF for C14 commit and poll.
 *
 * `POST` commits an uploaded object at a position; `GET` is the poll the
 * uploader runs until processing reports READY or FAILED. Both are proxied so
 * the API base URL stays server-side (Rule 9) and the session — not a
 * client-supplied dealer id — decides whose media this is (Rule 1).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = MediaCommitInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected { position }.' }, { status: 400 });
  }

  try {
    const result = await apiSend<MediaCommitResponse>(
      'POST',
      `/v1/dealer/media/${encodeURIComponent(id)}/commit`,
      parsed.data,
    );
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return problem(error);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const result = await apiGet<VehicleMediaDto>(`/v1/dealer/media/${encodeURIComponent(id)}`, {
      revalidate: false,
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return problem(error);
  }
}

function problem(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(error.problem, {
      status: error.status,
      headers: { 'Content-Type': 'application/problem+json' },
    });
  }
  return NextResponse.json({ error: 'Upstream unavailable.' }, { status: 502 });
}
