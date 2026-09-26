export type SniffedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(body: Buffer, bytes: number[], offset = 0): boolean {
  if (body.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => body[offset + index] === byte);
}

function ascii(body: Buffer, text: string, offset: number): boolean {
  return startsWith(body, [...Buffer.from(text, 'ascii')], offset);
}

export function sniffImageType(body: Buffer): SniffedImageType | null {
  if (startsWith(body, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(body, PNG)) return 'image/png';
  if (ascii(body, 'RIFF', 0) && ascii(body, 'WEBP', 8)) return 'image/webp';
  return null;
}

export const IMAGE_EXTENSIONS: Record<SniffedImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
