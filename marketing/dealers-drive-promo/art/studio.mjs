import { BACKDROPS } from './colors.mjs';
import { blur, fmt, linear, radial, uid } from './svg.mjs';

export function studio({ width, height, theme = 'studioLight', horizon }) {
  const t = BACKDROPS[theme] ?? BACKDROPS.studioLight;
  const id = uid('st');
  const hy = (horizon ?? t.horizon) * height;
  const dark = theme === 'studioDark';
  const defs = [
    linear(`${id}w`, [
      [0, t.wallTop],
      [1, t.wallBottom],
    ]),
    linear(`${id}f`, [
      [0, t.floorTop],
      [1, t.floorBottom],
    ]),
    radial(
      `${id}spot`,
      [
        [0, '#ffffff', dark ? 0.16 : 0.55],
        [1, '#ffffff', 0],
      ],
      { cx: 0.5, cy: 0.35, r: 0.55 },
    ),
    radial(
      `${id}v`,
      [
        [0.55, '#000', 0],
        [1, '#000', dark ? 0.55 : 0.18],
      ],
      { cx: 0.5, cy: 0.5, r: 0.75 },
    ),
    linear(
      `${id}hz`,
      [
        [0, '#fff', 0],
        [0.5, '#fff', dark ? 0.08 : 0.5],
        [1, '#fff', 0],
      ],
      { x1: 0, y1: 0, x2: 1, y2: 0 },
    ),
  ].join('');
  const back = [
    `<rect width="${width}" height="${fmt(hy)}" fill="url(#${id}w)"/>`,
    `<rect y="${fmt(hy)}" width="${width}" height="${fmt(height - hy)}" fill="url(#${id}f)"/>`,
    `<rect x="${fmt(width * 0.05)}" y="${fmt(hy - 1)}" width="${fmt(width * 0.9)}" height="2" fill="url(#${id}hz)"/>`,
    `<ellipse cx="${fmt(width / 2)}" cy="${fmt(hy * 0.55)}" rx="${fmt(width * 0.55)}" ry="${fmt(hy * 0.7)}" fill="url(#${id}spot)"/>`,
  ].join('');
  const front = `<rect width="${width}" height="${height}" fill="url(#${id}v)"/>`;
  return { defs, back, front, horizonY: hy, shadowOpacity: t.shadow, reflectOpacity: t.reflect };
}

export function groundShadow({ cx, cy, rx, ry, opacity = 0.5 }) {
  const id = uid('sh');
  const defs = blur(`${id}b`, ry * 0.9) + blur(`${id}c`, ry * 0.25);
  const body = `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(ry * 1.6)}" fill="#000" opacity="${fmt(opacity * 0.55)}" filter="url(#${id}b)"/><ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx * 0.92)}" ry="${fmt(ry * 0.4)}" fill="#000" opacity="${fmt(opacity * 0.8)}" filter="url(#${id}c)"/>`;
  return { defs, body };
}

export function reflection({ markup, groundY, opacity, height }) {
  const id = uid('rf');
  const defs =
    linear(
      `${id}m`,
      [
        [0, '#fff', 1],
        [1, '#fff', 0],
      ],
      { x1: 0, y1: 0, x2: 0, y2: 1 },
    ) +
    `<mask id="${id}mask" maskUnits="userSpaceOnUse"><rect x="-5000" y="${fmt(groundY)}" width="10000" height="${fmt(height)}" fill="url(#${id}m)"/></mask>` +
    blur(`${id}b`, 3);
  const body = `<g mask="url(#${id}mask)" opacity="${fmt(opacity)}"><g transform="translate(0 ${fmt(groundY * 2)}) scale(1 -1)" filter="url(#${id}b)">${markup}</g></g>`;
  return { defs, body };
}
