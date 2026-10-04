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

export interface Keyset {
  at: Date;
  id: string;
}

const KEYSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeKeysetCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');
}

export function decodeKeysetCursor(cursor: string): Keyset {
  const [stamp = '', id = ''] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const at = new Date(stamp);
  if (Number.isNaN(at.getTime()) || !KEYSET_ID.test(id)) {
    throw new ConflictError('MALFORMED_CURSOR', 'That page cursor is not valid.');
  }
  return { at, id };
}

export function decodeKeysetOrDateCursor(cursor: string): { at: Date; id: string | null } {
  const fields = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (fields.length === 1) return { at: decodeCursor(cursor), id: null };
  if (fields.length !== 2) {
    throw new ConflictError('MALFORMED_CURSOR', 'That page cursor is not valid.');
  }
  return decodeKeysetCursor(cursor);
}
