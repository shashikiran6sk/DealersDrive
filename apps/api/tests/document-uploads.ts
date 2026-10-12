import type { DealerDocCategory, DealerDocType } from '@prisma/client';
import type request from 'supertest';

/**
 * The two-category document upload, as a client performs it: presign, `PUT`
 * the bytes to the signed URL, commit. Shared so every suite that needs a
 * submitted application uploads the same way the onboarding screen does.
 */
export const PDF = Buffer.from('%PDF-1.4');

export interface Slot {
  category: Exclude<DealerDocCategory, 'SUPPORTING'>;
  type: DealerDocType;
}

/** One proof per category; with a GSTIN on file the business proof must be its certificate. */
export const DOCUMENT_SET: readonly Slot[] = [
  { category: 'PERSONAL_IDENTITY', type: 'PAN_CARD' },
  { category: 'BUSINESS_IDENTITY', type: 'GST_CERTIFICATE' },
];

export interface UploadOptions {
  body?: Buffer;
  mimeType?: string;
  fileName?: string;
  description?: string;
}

export async function uploadDocument(
  agent: request.Agent,
  base: string,
  slot: Slot,
  options: UploadOptions = {},
): Promise<string> {
  const body = options.body ?? PDF;
  const presigned = await agent
    .post(`${base}/documents/presign`)
    .send({
      ...slot,
      fileName: options.fileName ?? 'proof.pdf',
      mimeType: options.mimeType ?? 'application/pdf',
      bytes: body.length,
      ...(options.description ? { description: options.description } : {}),
    })
    .expect(201);
  const url = new URL(String(presigned.body.uploadUrl));
  await agent
    .put(url.pathname + url.search)
    .set('Content-Type', options.mimeType ?? 'application/pdf')
    .send(body)
    .expect(200);
  return String(presigned.body.documentId);
}

export async function submitDocument(
  agent: request.Agent,
  base: string,
  slot: Slot,
  options: UploadOptions = {},
): Promise<string> {
  const documentId = await uploadDocument(agent, base, slot, options);
  await agent.post(`${base}/documents/${slot.category}/commit`).send({ documentId }).expect(200);
  return documentId;
}

export async function submitDocumentSet(
  agent: request.Agent,
  base = '/v1/dealer',
  set: readonly Slot[] = DOCUMENT_SET,
): Promise<string[]> {
  const ids: string[] = [];
  for (const slot of set) ids.push(await submitDocument(agent, base, slot));
  return ids;
}
