export function accentForeground(color: string): '#ffffff' | '#000000' {
  const channels = [1, 3, 5]
    .map((at) => parseInt(color.slice(at, at + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  const luminance =
    (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

export function responsiveImageSet(url: string): string | undefined {
  if (!/\/by-media\/[0-9a-f-]+\/\d+\.webp$/.test(url)) return undefined;
  return [320, 640, 1024, 1600]
    .map((width) => `${url.replace(/\/\d+\.webp$/, `/${width}.webp`)} ${width}w`)
    .join(', ');
}
