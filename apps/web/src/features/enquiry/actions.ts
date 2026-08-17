'use server';

import {
  CreateEnquiryInput,
  type EnquiryCreatedResponse,
  type RevealContactResponse,
} from '@dealers-drive/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ENQUIRY_RESULT_COOKIE } from '@/features/enquiry/shared';
import type { EnquiryFormState, RevealContactResult } from '@/features/enquiry/shared';
import { ApiError, apiSend } from '@/lib/api';
import { clientIpHeaders } from '@/lib/client-ip';

/**
 * The two public mutations, as Server Actions.
 *
 * The enquiry form is a real `<form>` posting to this action, so it works with
 * JavaScript disabled (ARCHITECTURE §15.4) — and because the action runs on the
 * server, the API base URL, the buyer's IP and the response never have to be
 * exposed to the browser.
 */

export async function submitEnquiryAction(
  _previous: EnquiryFormState,
  formData: FormData,
): Promise<EnquiryFormState> {
  const text = (key: string): string | undefined => {
    const value = formData.get(key);
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  };
  /** A `File` in any of these fields is not a value we would ever accept. */
  const rawText = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };

  // Validated here as well as in the API: the client-side copy of this schema
  // is a convenience, and a form post that skipped it must not reach the wire
  // shape unchecked.
  const parsed = CreateEnquiryInput.safeParse({
    ...(text('vehicleId') ? { vehicleId: text('vehicleId') } : {}),
    ...(text('dealerSlug') ? { dealerSlug: text('dealerSlug') } : {}),
    name: rawText('name'),
    phone: rawText('phone'),
    ...(text('email') ? { email: text('email') } : {}),
    ...(text('message') ? { message: text('message') } : {}),
    source: rawText('source') || 'LISTING_PAGE',
    // The honeypot travels as-is: emptiness is the signal, and the API decides.
    website: rawText('website'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') fieldErrors[field] ??= issue.message;
    }
    return { status: 'error', fieldErrors };
  }

  let created: EnquiryCreatedResponse;
  try {
    created = await apiSend<EnquiryCreatedResponse>('POST', '/v1/enquiries', parsed.data, {
      headers: await clientIpHeaders(),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const fieldErrors = error.fieldErrors();
      return {
        status: 'error',
        fieldErrors,
        ...(Object.keys(fieldErrors).length > 0
          ? {}
          : { message: error.problem.detail ?? error.problem.title }),
      };
    }
    return {
      status: 'error',
      fieldErrors: {},
      message: 'We could not send your enquiry just now. Please try again.',
    };
  }

  // The success screen needs the reference, the dealer and the vehicle, and
  // there is no endpoint that reads an enquiry back by reference (API-SPEC has
  // none, and inventing one would hand anybody another buyer's details). So the
  // result travels in a short-lived httpOnly cookie the next render consumes.
  const store = await cookies();
  store.set(ENQUIRY_RESULT_COOKIE, JSON.stringify(created), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  redirect('/enquiry-sent');
}

/**
 * API-SPEC A7 — the anti-scraping gate. One click for a real buyer; a
 * `PhoneReveal` and a `CALL_BUTTON` enquiry for the dealer's inbox; a hard
 * per-IP ceiling for everyone else.
 */
export async function revealContactAction(
  vehicleId: string,
  captchaToken?: string,
): Promise<RevealContactResult> {
  try {
    const contact = await apiSend<RevealContactResponse>(
      'POST',
      `/v1/vehicles/${vehicleId}/reveal-contact`,
      { captchaToken: captchaToken ?? null, name: null },
      { headers: await clientIpHeaders() },
    );
    return { status: 'revealed', contact };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'CAPTCHA_REQUIRED') {
        return {
          status: 'captcha',
          message: error.problem.detail ?? 'Complete the challenge to see this number.',
        };
      }
      return { status: 'error', message: error.problem.detail ?? error.problem.title };
    }
    return { status: 'error', message: 'We could not fetch the number. Please try again.' };
  }
}
