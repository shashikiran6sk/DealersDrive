import { createHash } from 'node:crypto';

const WIDTH_SUFFIX = /\/\d+\.webp$/;
const BY_MEDIA = /\/by-media\/([0-9a-f-]{8,})\//i;

export function atWidth(url: string, width: number): string {
  return WIDTH_SUFFIX.test(url) ? url.replace(WIDTH_SUFFIX, `/${width}.webp`) : url;
}

export function mediaFileName(url: string): string {
  const id = BY_MEDIA.exec(url)?.[1];
  if (id !== undefined) return `${id.toLowerCase()}.webp`;
  const digest = createHash('sha256').update(url).digest('hex').slice(0, 24);
  const extension = /\.(png|jpe?g|webp|svg)(?:\?|$)/i.exec(url)?.[1]?.toLowerCase() ?? 'img';
  return `${digest}.${extension}`;
}

export type MediaPlan = {
  src: (url: string) => string;
  files: () => Map<string, string>;
};

export function planMedia(width: number, folder = 'media'): MediaPlan {
  const wanted = new Map<string, string>();
  return {
    src(url) {
      const sized = atWidth(url, width);
      const file = `${folder}/${mediaFileName(sized)}`;
      wanted.set(file, sized);
      return file;
    },
    files: () => new Map(wanted),
  };
}
