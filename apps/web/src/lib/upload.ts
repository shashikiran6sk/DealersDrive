import type { PresignResponse } from '@dealers-drive/contracts';

import { readJson } from './fetch-json';

/**
 * The browser half of the presign → PUT → commit pipeline (ARCHITECTURE §12.1).
 *
 * The file never passes through the Next server: only the signing and commit
 * calls are proxied, because those need the session. The yard photograph and the
 * three KYC documents both walk it, so the steps live here rather than twice
 * over — the messages stay each caller's, because "we could not record that
 * photo" and "we could not record that document" are what the dealer reads.
 */
export interface FileRule {
  maxBytes: number;
  mimeTypes: readonly string[];
  tooLarge: string;
  wrongType: string;
}

/** The message to show, or `null` when the file is acceptable. */
export function fileRejection(file: File, rule: FileRule): string | null {
  if (file.size > rule.maxBytes) return rule.tooLarge;
  if (!rule.mimeTypes.includes(file.type)) return rule.wrongType;
  return null;
}

export async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function presign(path: string, body: unknown): Promise<PresignResponse> {
  const response = await postJson(path, body);
  if (!response.ok) throw new Error('We could not start that upload.');
  return readJson<PresignResponse>(response);
}

/** The one step the bytes actually travel on — straight to object storage. */
export async function putToStorage(signed: PresignResponse, file: File): Promise<void> {
  const put = await fetch(signed.uploadUrl, {
    method: signed.method,
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error('The upload was rejected by storage.');
}

/** What an upload or removal failed with, as a sentence a dealer can read. */
export function failureMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}
