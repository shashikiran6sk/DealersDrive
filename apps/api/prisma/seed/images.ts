import { encode } from 'blurhash';
import sharp from 'sharp';

/**
 * Placeholder photography.
 *
 * The prototype renders every image as an `<image-slot>` — a flat
 * `--color-surface` panel carrying the name of the shot — and the twenty screen
 * captures show exactly that. Seeding real photographs would make the running
 * app look *unlike* its own reference, so the seed generates the same panels as
 * genuine image files: real bytes, real dimensions, real derivatives and a real
 * blurhash, flowing through the same media pipeline a dealer's upload does.
 */
export const DERIVATIVE_WIDTHS = [320, 640, 1024, 1600] as const;

const GROUND = '#eaecf0';
const INK = '#14171c';

function panelSvg(width: number, height: number, label: string): Buffer {
  const fontSize = Math.round(width / 26);
  const iconSize = Math.round(width / 12);
  const cx = width / 2;
  const cy = height / 2;
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${GROUND}"/>
      <g opacity="0.38" fill="none" stroke="${INK}" stroke-width="${Math.max(2, width / 320)}">
        <rect x="${cx - iconSize / 2}" y="${cy - iconSize * 0.85}"
              width="${iconSize}" height="${iconSize * 0.8}"/>
        <circle cx="${cx - iconSize * 0.22}" cy="${cy - iconSize * 0.58}" r="${iconSize * 0.09}"/>
        <path d="M ${cx - iconSize / 2} ${cy - iconSize * 0.25}
                 L ${cx - iconSize * 0.1} ${cy - iconSize * 0.5}
                 L ${cx + iconSize / 2} ${cy - iconSize * 0.05}"/>
      </g>
      <text x="${cx}" y="${cy + iconSize * 0.55}" text-anchor="middle"
            font-family="Inter, Helvetica, Arial, sans-serif" font-size="${fontSize}"
            fill="${INK}" fill-opacity="0.55">${escaped}</text>
    </svg>`,
  );
}

export interface GeneratedImage {
  width: number;
  height: number;
  blurhash: string;
  /** width -> webp bytes, largest first. */
  derivatives: { width: number; body: Buffer }[];
  bytes: number;
}

export async function generatePlaceholderImage(label: string): Promise<GeneratedImage> {
  const master = await sharp(panelSvg(1600, 1200, label)).png().toBuffer();

  const derivatives = await Promise.all(
    DERIVATIVE_WIDTHS.map(async (width) => ({
      width,
      body: await sharp(master)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
    })),
  );

  const { data, info } = await sharp(master)
    .resize(32, 24, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
  const largest = derivatives[derivatives.length - 1];

  return {
    width: 1600,
    height: 1200,
    blurhash,
    derivatives,
    bytes: largest?.body.length ?? 0,
  };
}
