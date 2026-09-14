import { ConflictError } from './errors.js';

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
