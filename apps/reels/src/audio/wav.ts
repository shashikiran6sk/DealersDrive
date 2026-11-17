import { sampleAt } from '../lib/pick';

import type { Mix } from './mix';

const HEADER_BYTES = 44;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const MAX_16_BIT = 32767;

export function encodeWav(mix: Mix): Uint8Array {
  const frames = mix.left.length;
  const dataBytes = frames * CHANNELS * BYTES_PER_SAMPLE;
  const bytes = new Uint8Array(HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, mix.sampleRate, true);
  view.setUint32(28, mix.sampleRate * CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(32, CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);

  const toInt = (value: number) => Math.round(Math.max(-1, Math.min(1, value)) * MAX_16_BIT);
  for (let frame = 0; frame < frames; frame += 1) {
    const offset = HEADER_BYTES + frame * CHANNELS * BYTES_PER_SAMPLE;
    view.setInt16(offset, toInt(sampleAt(mix.left, frame)), true);
    view.setInt16(offset + BYTES_PER_SAMPLE, toInt(sampleAt(mix.right, frame)), true);
  }
  return bytes;
}
