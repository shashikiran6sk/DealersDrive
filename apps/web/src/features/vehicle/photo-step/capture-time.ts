const JPEG_START = 0xffd8;
const APP1 = 0xffe1;
const START_OF_SCAN = 0xffda;
const EXIF_HEADER = 0x45786966;
const LITTLE_ENDIAN = 0x4949;
const TIFF_MAGIC = 42;
const EXIF_IFD_POINTER = 0x8769;
const DATE_TIME_ORIGINAL = 0x9003;
const SUB_SEC_TIME_ORIGINAL = 0x9291;
const ENTRY_BYTES = 12;
const INLINE_VALUE_BYTES = 4;
const EXIF_READ_BYTES = 131_072;

interface Tiff {
  view: DataView;
  start: number;
  little: boolean;
}

function entryOffset(tiff: Tiff, ifd: number, tag: number): number | null {
  const count = tiff.view.getUint16(ifd, tiff.little);
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * ENTRY_BYTES;
    if (tiff.view.getUint16(entry, tiff.little) === tag) return entry;
  }
  return null;
}

function asciiValue(tiff: Tiff, entry: number): string {
  const length = tiff.view.getUint32(entry + 4, tiff.little);
  const at =
    length <= INLINE_VALUE_BYTES
      ? entry + 8
      : tiff.start + tiff.view.getUint32(entry + 8, tiff.little);
  let text = '';
  for (let index = 0; index < length; index += 1) {
    const code = tiff.view.getUint8(at + index);
    if (code === 0) break;
    text += String.fromCharCode(code);
  }
  return text;
}

function parseExifDate(text: string, subSeconds: string): number | null {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (!year || !month || !day || hour === undefined || minute === undefined || second === undefined)
    return null;
  const fraction = /^\d+$/.test(subSeconds) ? Number(`0.${subSeconds}`) * 1000 : 0;
  return Date.UTC(year, month - 1, day, hour, minute, second) + Math.round(fraction);
}

function captureTimeFromTiff(view: DataView, start: number): number | null {
  if (view.getUint32(start) !== EXIF_HEADER || view.getUint16(start + 4) !== 0) return null;
  const tiffStart = start + 6;
  const little = view.getUint16(tiffStart) === LITTLE_ENDIAN;
  const tiff: Tiff = { view, start: tiffStart, little };
  if (view.getUint16(tiffStart + 2, little) !== TIFF_MAGIC) return null;
  const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
  const pointer = entryOffset(tiff, ifd0, EXIF_IFD_POINTER);
  if (pointer === null) return null;
  const exifIfd = tiffStart + view.getUint32(pointer + 8, little);
  const original = entryOffset(tiff, exifIfd, DATE_TIME_ORIGINAL);
  if (original === null) return null;
  const subSeconds = entryOffset(tiff, exifIfd, SUB_SEC_TIME_ORIGINAL);
  return parseExifDate(
    asciiValue(tiff, original),
    subSeconds === null ? '' : asciiValue(tiff, subSeconds).trim(),
  );
}

export function exifCaptureTime(buffer: ArrayBuffer): number | null {
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== JPEG_START) return null;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if (marker === START_OF_SCAN || (marker & 0xff00) !== 0xff00) return null;
      const length = view.getUint16(offset + 2);
      if (marker === APP1) {
        const taken = captureTimeFromTiff(view, offset + 4);
        if (taken !== null) return taken;
      }
      offset += 2 + length;
    }
    return null;
  } catch {
    return null;
  }
}

async function takenAt(file: File): Promise<number | null> {
  if (file.type !== 'image/jpeg') return null;
  try {
    return exifCaptureTime(await file.slice(0, EXIF_READ_BYTES).arrayBuffer());
  } catch {
    return null;
  }
}

const byName = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export async function inCaptureOrder(files: readonly File[]): Promise<File[]> {
  const keyed = await Promise.all(
    files.map(async (file, index) => ({
      file,
      index,
      time: (await takenAt(file)) ?? file.lastModified,
    })),
  );
  return keyed
    .sort(
      (a, b) => a.time - b.time || byName.compare(a.file.name, b.file.name) || a.index - b.index,
    )
    .map((entry) => entry.file);
}
