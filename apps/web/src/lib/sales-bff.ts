import 'server-only';

import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

import { apiSend } from './api';
import { problemResponse } from './bff';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function salesDealerPath(id: string): string | null {
  return UUID.test(id) ? `/v1/sales/dealers/${id}` : null;
}

export async function proxyJson<T>(
  request: Request,
  schema: ZodType<T>,
  path: string | null,
  route: string,
  status = 200,
): Promise<NextResponse> {
  if (!path) return NextResponse.json({ error: 'Unknown dealership.' }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'That upload cannot be accepted.' }, { status: 400 });
  }
  try {
    return NextResponse.json(await apiSend('POST', path, parsed.data), { status });
  } catch (error) {
    return problemResponse(error, route);
  }
}

export async function proxyDelete(path: string | null, route: string): Promise<NextResponse> {
  if (!path) return NextResponse.json({ error: 'Unknown dealership.' }, { status: 400 });
  try {
    await apiSend('DELETE', path);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return problemResponse(error, route);
  }
}
