import type { Tx } from '../db/prisma.js';
import { enqueueOutbox, type DomainEvent } from '../events/bus.js';

export interface MediaUploadedFact {
  mediaId: string;
  dealerId: string | null;
  actor: DomainEvent['actor'];
  traceId: string;
}

export async function recordMediaUploaded(
  tx: Tx,
  { mediaId, dealerId, actor, traceId }: MediaUploadedFact,
): Promise<void> {
  await enqueueOutbox(tx, {
    type: 'MediaUploaded',
    aggregateType: 'Media',
    aggregateId: mediaId,
    ...(dealerId === null ? {} : { dealerId }),
    actor,
    traceId,
    payload: { mediaId },
  });
}
