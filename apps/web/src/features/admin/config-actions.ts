'use server';

import { UpdateConfigInput, type ConfigEntry } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicConfig } from '@/lib/cache-tags';

export interface ConfigResult {
  ok: boolean;
  message?: string;
}

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
    revalidatePublicConfig();
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.userMessage(error.problem.title) };
    }
    return { ok: false, message: 'We could not save that setting.' };
  }
}
