import sharp from 'sharp';

// Valid encoded photographs: signature-only fixtures conceal decoder failures.
const image = sharp({ create: { width: 32, height: 24, channels: 3, background: '#436a8c' } });
export const JPEG = await image.clone().jpeg().toBuffer();
export const PNG = await image.clone().png().toBuffer();
