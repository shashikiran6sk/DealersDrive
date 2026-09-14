import type { PresignResponse } from '@dealers-drive/contracts';

import { readJson } from './fetch-json';

export interface FileRule {
  maxBytes: number;
  mimeTypes: readonly string[];
  tooLarge: string;
  wrongType: string;
}

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

export async function putToStorage(signed: PresignResponse, file: File): Promise<void> {
  const put = await fetch(signed.uploadUrl, {
    method: signed.method,
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error('The upload was rejected by storage.');
}

export function failureMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}
