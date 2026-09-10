'use server';

import { DealerSelfUpdateInput, type DealerProfile } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer } from '@/lib/cache-tags';
import { servicesOf } from '@/lib/services';

export interface ProfileFormState {
  status: 'idle' | 'saved' | 'error';
  fieldErrors: Record<string, string>;
  message?: string;
}

/**
 * C2 `PATCH /v1/dealer` — three fields (**R27**).
 *
 * Which dealer is being edited is never in this payload — the API takes it from
 * the session (Rule 1). Nor are `status`, `slug` or `creditBalance` accepted by
 * `DealerSelfUpdateInput`: a dealer cannot verify or fund themselves by editing
 * their own profile.
 *
 * And since R27, neither can they edit the record their verification was *about*
 * — the registered name, the address, the town, the pin, the mobile, the email.
 * Those are read-only on the form and absent from this schema, which is two
 * defences for one rule and deliberately so: the disabled inputs are why a
 * dealer never sends one, and `.strict()` is why it would not be written if
 * they did.
 *
 * The payload is therefore built from three keys rather than filtered down from
 * the form. A form that grows a box nobody meant to accept is the failure this
 * shape prevents.
 */
export async function saveDealerProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const text = (key: string): string | undefined => {
    const value = formData.get(key);
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const specialities = servicesOf(text('specialities') ?? '');

  const year = text('establishedYear');

  const parsed = DealerSelfUpdateInput.safeParse({
    ...(year ? { establishedYear: Number(year) } : {}),
    ...(text('tagline') ? { tagline: text('tagline') } : {}),
    ...(specialities.length > 0 ? { specialities } : {}),
  });

  if (!parsed.success) {
    return { status: 'error', fieldErrors: flatten(parsed.error.issues) };
  }

  let saved: DealerProfile;
  try {
    saved = await apiSend<DealerProfile>('PATCH', '/v1/dealer', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      const fieldErrors = mapApiFields(error.fieldErrors());
      return {
        status: 'error',
        fieldErrors,
        ...(Object.keys(fieldErrors).length > 0
          ? {}
          : { message: error.userMessage(error.problem.title) }),
      };
    }
    return { status: 'error', fieldErrors: {}, message: 'We could not save your changes.' };
  }

  // The dealership's name is in the console top bar and on every public card.
  revalidatePath('/dealer', 'layout');

  /*
   * And on the public pages, which is the half that was missing.
   *
   * Everything on this form is rendered to buyers — the name, the address, the
   * Maps link the portfolio draws its map from, the opening hours — and none of
   * it moved until two ten-minute windows had expired. A dealer correcting
   * their own pin watched a stale page and reasonably concluded the save had
   * not worked.
   *
   * The slug comes off the response rather than the session, because it is the
   * dealership this PATCH actually wrote: `dealerId` comes from the session on
   * the API side (rule 1), so the row that answered is the row that changed.
   */
  revalidatePublicDealer(saved.slug);

  return { status: 'saved', fieldErrors: {} };
}

/**
 * C2c — the dealer taking their own proposal back (**R34**).
 *
 * `DELETE /v1/dealer/profile-change`, and the same two revalidations the save
 * does. The public pages did not change — the proposal was never published —
 * but the dealer's own console did, and `revalidatePath('/dealer', 'layout')`
 * is what re-renders the profile screen with the boxes unlocked.
 *
 * `revalidatePublicDealer` is kept for the same reason the admin refusal keeps
 * it: it costs one re-fetch of a page that comes back identical, and leaving it
 * out would make this the one write path in the file that has to be reasoned
 * about separately.
 *
 * A bare `Promise<string | null>` rather than a form state, because there is no
 * form: the panel renders a button, and the only thing it can usefully say back
 * is what went wrong.
 */
export async function withdrawProfileChangeAction(): Promise<string | null> {
  let saved: DealerProfile;
  try {
    saved = await apiSend<DealerProfile>('DELETE', '/v1/dealer/profile-change', undefined);
  } catch (error) {
    if (error instanceof ApiError) {
      // A 404 is the ordinary race — a double-click, or a decision that landed
      // while the page was open. The screen is stale either way, and re-reading
      // it is the fix, so it is not worth an error the dealer has to dismiss.
      if (error.status === 404) {
        revalidatePath('/dealer', 'layout');
        return null;
      }
      return error.userMessage(error.problem.title);
    }
    return 'We could not cancel that change.';
  }

  revalidatePath('/dealer', 'layout');
  revalidatePublicDealer(saved.slug);
  return null;
}

/**
 * Zod's dotted paths, folded onto the input names the form uses.
 *
 * `contact.email` is the input named `contactEmail`, and `address.mapsUrl` the
 * one named `addressMapsUrl`. One function does it for both the local parse and
 * the API's refusal, because the two answer in the same vocabulary and a form
 * that highlighted the right box for one and not the other would be a puzzle
 * to debug.
 */
function flatten(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const [head, tail] = issue.path;
    const field =
      typeof head === 'string' && typeof tail === 'string' ? camel(head, tail) : String(head);
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

/** `validate()` has already stripped the `body.` prefix; the shape is the same. */
function mapApiFields(errors: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [path, message] of Object.entries(errors)) {
    const [head, tail] = path.split('.');
    const field = head !== undefined && tail !== undefined ? camel(head, tail) : path;
    mapped[field] ??= message;
  }
  return mapped;
}

function camel(head: string, tail: string): string {
  return `${head}${tail.charAt(0).toUpperCase()}${tail.slice(1)}`;
}
