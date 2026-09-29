import { YardPhotoPresignInput, type PresignResponse } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = YardPhotoPresignInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'That image cannot be uploaded.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await apiSend<PresignResponse>(
      'POST',
      '/v1/dealer/yard-photo/presign',
      parsed.data,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return problemResponse(error, '/api/dealer/yard-photo/presign');
  }
}
