'use server';

import {
  AddStorefrontDomainInput,
  CreateStorefrontInput,
  IdParam,
  PresignResponse,
  SetPublicationInput,
  StorefrontBrandingInput,
  StorefrontMediaPresignInput,
  StorefrontMediaReceipt,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';

import { ApiError, apiSend } from '@/lib/api';

export type WebsiteActionState = { status: 'idle' | 'saved' | 'error'; message?: string };
const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};
async function save<T>(
  schema: z.ZodType<T>,
  value: unknown,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
): Promise<WebsiteActionState> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Check your input.' };
  try {
    await apiSend(method, path, parsed.data);
    revalidatePath('/dealer/website', 'layout');
    return {
      status: 'saved',
      message: 'Saved. The status shown below is the current website status.',
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof ApiError
          ? error.userMessage()
          : 'We could not save this change. Please try again.',
    };
  }
}
export async function createWebsiteAction(_previous: WebsiteActionState, form: FormData) {
  return save(
    CreateStorefrontInput,
    { subdomain: text(form, 'subdomain'), theme: text(form, 'theme') },
    'POST',
    '/v1/dealer/storefront',
  );
}
export async function saveWebsiteBrandingAction(_previous: WebsiteActionState, form: FormData) {
  return save(
    StorefrontBrandingInput,
    {
      displayName: text(form, 'displayName'),
      theme: text(form, 'theme'),
      accentColor: text(form, 'accentColor'),
      headline: text(form, 'headline'),
      description: text(form, 'description'),
      about: text(form, 'about'),
      contactPhone: text(form, 'contactPhone') || null,
      whatsappPhone: text(form, 'whatsappPhone') || null,
      mapsUrl: text(form, 'mapsUrl') || null,
      seoTitle: text(form, 'seoTitle'),
      seoDescription: text(form, 'seoDescription'),
      socialUrls: text(form, 'socialUrls')
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean),
      logoMediaId: text(form, 'logoMediaId') || null,
      heroMediaId: text(form, 'heroMediaId') || null,
      yardMediaIds: text(form, 'yardMediaIds').split(',').filter(Boolean),
    },
    'PATCH',
    '/v1/dealer/storefront',
  );
}
export async function setWebsiteEnabledAction(
  enabled: boolean,
  _previous: WebsiteActionState,
  _form: FormData,
): Promise<WebsiteActionState> {
  try {
    await apiSend('PUT', '/v1/dealer/storefront/enabled', { enabled });
    revalidatePath('/dealer/website', 'layout');
    return {
      status: 'saved',
      message: enabled
        ? 'Activation checked. Review the current status below.'
        : 'Website disabled.',
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof ApiError ? error.userMessage() : 'We could not update the website status.',
    };
  }
}
export async function addWebsiteDomainAction(_previous: WebsiteActionState, form: FormData) {
  return save(
    AddStorefrontDomainInput,
    { hostname: text(form, 'hostname') },
    'POST',
    '/v1/dealer/storefront/domains',
  );
}
export async function websiteDomainAction(
  id: string,
  operation: 'refresh' | 'primary' | 'remove',
  _previous: WebsiteActionState,
  _form: FormData,
): Promise<WebsiteActionState> {
  if (!IdParam.safeParse({ id }).success || !['refresh', 'primary', 'remove'].includes(operation))
    return { status: 'error', message: 'Invalid domain operation.' };
  try {
    await apiSend(
      operation === 'refresh' ? 'POST' : operation === 'primary' ? 'PUT' : 'DELETE',
      `/v1/dealer/storefront/domains/${id}${operation === 'remove' ? '' : `/${operation}`}`,
      undefined,
    );
    revalidatePath('/dealer/website', 'layout');
    return {
      status: 'saved',
      message: 'Request completed. Review the current domain status below.',
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof ApiError ? error.userMessage() : 'We could not update this domain.',
    };
  }
}
export async function setWebsitePublicationAction(
  id: string,
  _previous: WebsiteActionState,
  form: FormData,
) {
  if (!IdParam.safeParse({ id }).success)
    return { status: 'error' as const, message: 'Invalid listing.' };
  return save(
    SetPublicationInput,
    {
      marketplacePublished: form.get('marketplacePublished') === 'on',
      storefrontPublished: form.get('storefrontPublished') === 'on',
    },
    'PUT',
    `/v1/dealer/storefront/publication/${id}`,
  );
}
export async function websiteUploadAction(input: unknown) {
  const parsed = StorefrontMediaPresignInput.safeParse(input);
  if (!parsed.success) return { error: 'Choose a JPEG, PNG or WebP image smaller than 8 MiB.' };
  try {
    return {
      upload: PresignResponse.parse(
        await apiSend('POST', '/v1/dealer/storefront/media/presign', parsed.data),
      ),
    };
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.userMessage() : 'The image could not be uploaded.',
    };
  }
}
export async function websiteCommitUploadAction(mediaId: string) {
  if (!IdParam.safeParse({ id: mediaId }).success) return { error: 'Invalid upload.' };
  try {
    return {
      media: StorefrontMediaReceipt.parse(
        await apiSend('POST', '/v1/dealer/storefront/media/commit', { mediaId }),
      ),
    };
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.userMessage() : 'The image could not be processed.',
    };
  }
}
