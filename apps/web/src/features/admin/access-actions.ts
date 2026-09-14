'use server';

import { GrantAdminAccessInput, type AdminAccessEntry } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

export interface AccessResult {
  ok: boolean;
  message?: string;
  entry?: AdminAccessEntry;
}

export async function grantAdminAccessAction(input: {
  email: string;
  adminRole: string;
}): Promise<AccessResult> {
  const parsed = GrantAdminAccessInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue ? messageFor(issue.path[0]) : 'That is not a valid entry.' };
  }

  try {
    const entry = await apiSend<AdminAccessEntry>('POST', '/v1/admin/access', parsed.data);
    revalidatePath('/admin/config');
    return { ok: true, entry };
  } catch (error) {
    return fail(error, 'We could not grant that access.');
  }
}

export async function revokeAdminAccessAction(userId: string): Promise<AccessResult> {
  try {
    await apiSend('DELETE', `/v1/admin/access/${encodeURIComponent(userId)}`);
    revalidatePath('/admin/config');
    return { ok: true };
  } catch (error) {
    return fail(error, 'We could not withdraw that access.');
  }
}

function fail(error: unknown, fallback: string): AccessResult {
  if (error instanceof ApiError) {
    return { ok: false, message: error.userMessage(error.problem.title) };
  }
  return { ok: false, message: fallback };
}

function messageFor(field: PropertyKey | undefined): string {
  return field === 'email' ? 'Enter a valid email address.' : 'Choose a role for this operator.';
}
