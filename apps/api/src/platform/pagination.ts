import { ConflictError } from './errors.js';

/**
 * Opaque cursors, shared by every paginated list.
 *
 * They started life inside the enquiries module and were imported from three
 * others, which is exactly the coupling ARCHITECTURE §5.5 rule 3 forbids. They
 * are not enquiry logic — they are the encoding of "where the last page ended" —
 * so they belong to the platform.
 *
 * The cursor is base64url so it reads as opaque to a client. It is not a secret:
 * anyone can decode it, and there is nothing in it worth hiding. What matters is
 * that a client cannot *construct* one that means something else — hence the
 * validation on the way back in.
 */
export function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64url');
}

export function decodeCursor(cursor: string): Date {
  const value = new Date(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (Number.isNaN(value.getTime())) {
    throw new ConflictError('MALFORMED_CURSOR', 'That page cursor is not valid.');
  }
  return value;
}

/** The ledger paginates on its append sequence, not on a timestamp. */
export function encodeSeqCursor(seq: bigint): string {
  return Buffer.from(String(seq)).toString('base64url');
}

export function decodeSeqCursor(cursor: string): string {
  const value = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!/^\d+$/.test(value)) {
    throw new ConflictError('MALFORMED_CURSOR', 'That page cursor is not valid.');
  }
  return value;
}
