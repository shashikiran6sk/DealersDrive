'use server';

import { UpdateConfigInput, type ConfigEntry } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicConfig } from '@/lib/cache-tags';

export interface ConfigResult {
  ok: boolean;
  message?: string;
}

/**
 * D14 — platform configuration.
 *
 * These values govern money and moderation (GST percent, listing duration,
 * minimum photos, rate limits), so each one is written individually with its
 * declared type rather than as a blob PATCH — a string where a number belongs
 * would silently change what a credit costs.
 */
export async function updateConfigAction(
  key: string,
  type: ConfigEntry['type'],
  raw: string,
): Promise<ConfigResult> {
  const value =
    type === 'number'
      ? Number(raw)
      : type === 'boolean'
        ? raw === 'true'
        : type === 'string[]'
          ? raw
              .split('\n')
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0)
          : raw;

  if (type === 'number' && !Number.isFinite(value)) {
    return { ok: false, message: 'That is not a number.' };
  }

  const parsed = UpdateConfigInput.safeParse({ value });
  if (!parsed.success) return { ok: false, message: 'That value is not valid for this key.' };

  try {
    await apiSend('PUT', `/v1/admin/config/${encodeURIComponent(key)}`, parsed.data);
    revalidatePath('/admin/config');
    /*
     * Some of these keys are rendered on public pages — the social links in
     * the footer are (**R44**) — and those pages hold the payload for ten
     * minutes. Clearing the tag unconditionally rather than only for the keys
     * that are public: the set of public keys is a fact about the API, and a
     * second copy of it here would be wrong the first time one is added.
     */
    revalidatePublicConfig();
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.userMessage(error.problem.title) };
    }
    return { ok: false, message: 'We could not save that setting.' };
  }
}
