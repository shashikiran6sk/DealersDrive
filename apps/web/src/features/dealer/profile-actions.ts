'use server';

import { UpdateDealerInput, type DealerProfile } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer } from '@/lib/cache-tags';

export interface ProfileFormState {
  status: 'idle' | 'saved' | 'error';
  fieldErrors: Record<string, string>;
  message?: string;
}

/**
 * C2 `PATCH /v1/dealer`.
 *
 * Which dealer is being edited is never in this payload — the API takes it from
 * the session (Rule 1). Nor are `status`, `slug` or `creditBalance` accepted by
 * `UpdateDealerInput`: a dealer cannot verify or fund themselves by editing
 * their own profile.
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

  const specialities = (text('specialities') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const year = text('establishedYear');

  const parsed = UpdateDealerInput.safeParse({
    ...(text('legalName') ? { legalName: text('legalName') } : {}),
    ...(text('tagline') ? { tagline: text('tagline') } : {}),
    ...(year ? { establishedYear: Number(year) } : {}),
    ...(specialities.length > 0 ? { specialities } : {}),
    contact: {
      ...(text('contactFullName') ? { fullName: text('contactFullName') } : {}),
      ...(text('contactRoleTitle') ? { roleTitle: text('contactRoleTitle') } : {}),
      ...(text('contactEmail') ? { email: text('contactEmail') } : {}),
      ...(text('contactPhone') ? { phone: text('contactPhone') } : {}),
      ...(text('contactLandline') ? { landline: text('contactLandline') } : {}),
    },
    address: {
      ...(text('addressLine') ? { line: text('addressLine') } : {}),
      ...(text('addressCity') ? { city: text('addressCity') } : {}),
      ...(text('addressDistrict') ? { district: text('addressDistrict') } : {}),
      ...(text('addressState') ? { state: text('addressState') } : {}),
      ...(text('addressPincode') ? { pincode: text('addressPincode') } : {}),
      ...(text('addressMapsUrl') ? { mapsUrl: text('addressMapsUrl') } : {}),
    },
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
