import { expect } from 'vitest';

/** A minimal reader for the stored zips the API writes, for tests only. */
export interface ReadEntry {
  name: string;
  data: Buffer;
  crc: number;
}

export function readZip(zip: Buffer): ReadEntry[] {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);
  const entries: ReadEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    expect(zip.readUInt32LE(cursor)).toBe(0x02014b50);
    const crc = zip.readUInt32LE(cursor + 16);
    const size = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const offset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    expect(zip.readUInt32LE(offset)).toBe(0x04034b50);
    const localName = zip.readUInt16LE(offset + 26);
    const start = offset + 30 + localName;
    entries.push({ name, data: zip.subarray(start, start + size), crc });
    cursor += 46 + nameLength;
  }
  return entries;
}
