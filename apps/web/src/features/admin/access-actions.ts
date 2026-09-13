'use server';

import { GrantAdminAccessInput, type AdminAccessEntry } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

export interface AccessResult {
  ok: boolean;
  message?: string;
  entry?: AdminAccessEntry;
}

/**
 * Who may open the admin console (**R42**).
 *
 * This is the most consequential write on the settings screen and the only one
 * that hands somebody a cross-tenant seat, so it goes through the same
 * `.strict()` contract the API validates with before the request leaves — a
 * typo'd field becomes a message in the form rather than a 400 to interpret.
 *
 * The address is lower-cased and trimmed by the schema, on both sides, because
 * the value on the left was typed by a person and the value it will eventually
 * be compared against came out of a Google identity token.
 */
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
