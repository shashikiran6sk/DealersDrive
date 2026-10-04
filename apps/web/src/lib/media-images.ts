const WIDTHS = [320, 640, 1024, 1600] as const;

export function imageAtWidth(url: string, width: number): string {
  return url.replace(/(\/by-media\/[^/]+\/)(320|640|1024|1600)\.webp$/, `$1${String(width)}.webp`);
}

export function responsiveImage(url: string): string | undefined {
  if (!/\/by-media\/[^/]+\/(320|640|1024|1600)\.webp$/.test(url)) return undefined;
  return WIDTHS.map((width) => `${imageAtWidth(url, width)} ${String(width)}w`).join(', ');
}
