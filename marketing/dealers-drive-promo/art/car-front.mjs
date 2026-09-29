import { catmullRom, fmt, linear, mix, radial, uid } from './svg.mjs';

export const FRONT_SPECS = {
  HATCHBACK: {
    width: 900,
    ratio: 0.86,
    belt: 0.58,
    roofW: 0.54,
    glassW: 0.76,
    clearance: 0.1,
    flare: 1.0,
  },
  SEDAN: {
    width: 950,
    ratio: 0.76,
    belt: 0.6,
    roofW: 0.5,
    glassW: 0.74,
    clearance: 0.09,
    flare: 1.0,
  },
  SUV: {
    width: 980,
    ratio: 0.9,
    belt: 0.62,
    roofW: 0.58,
    glassW: 0.78,
    clearance: 0.13,
    flare: 1.0,
  },
  MUV: { width: 960, ratio: 0.92, belt: 0.6, roofW: 0.6, glassW: 0.8, clearance: 0.11, flare: 1.0 },
  LUXURY: {
    width: 1000,
    ratio: 0.72,
    belt: 0.62,
    roofW: 0.5,
    glassW: 0.74,
    clearance: 0.09,
    flare: 1.0,
  },
};

function plate(cx, cy, w, h) {
  return `<rect x="${fmt(cx - w / 2)}" y="${fmt(cy - h / 2)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(h * 0.12)}" fill="#141517" stroke="#3b3e42" stroke-width="2"/><text x="${fmt(cx)}" y="${fmt(cy + h * 0.17)}" text-anchor="middle" font-family="Manrope, 'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="${fmt(h * 0.42)}" letter-spacing="${fmt(h * 0.04)}" fill="#f4f4f4">Dealers-Drive</text>`;
}

export function carFront({
  body = 'SUV',
  paint,
  view = 'front',
  grilleStyle = 'slats',
  lampStyle = 'slim',
  scale = 1,
  plateMask = true,
}) {
  const s = FRONT_SPECS[body] ?? FRONT_SPECS.SUV;
  const W = s.width * scale;
  const H = W * s.ratio;
  const id = uid('cf');
  const half = W / 2;
  const Y = (h) => -h * H;
  const beltY = Y(s.belt);
  const clr = s.clearance;

  const tyreW = W * 0.13;
  const tyreH = H * 0.2;
  const tyres = [-1, 1]
    .map((side) => {
      const x = side * (half - tyreW * 0.75) - tyreW / 2;
      return `<rect x="${fmt(x)}" y="${fmt(-tyreH)}" width="${fmt(tyreW)}" height="${fmt(tyreH)}" rx="${fmt(tyreW * 0.28)}" fill="url(#${id}ty)"/>`;
    })
    .join('');

  const lower = [
    [-half * 0.9, Y(clr)],
    [-half * 0.985, Y(clr + 0.08)],
    [-half, Y(clr + 0.25)],
    [-half * 0.985, Y(s.belt - 0.1)],
    [-half * 0.93, Y(s.belt - 0.025)],
    [-half * (s.glassW + 0.06), Y(s.belt + 0.005)],
    [half * (s.glassW + 0.06), Y(s.belt + 0.005)],
    [half * 0.93, Y(s.belt - 0.025)],
    [half * 0.985, Y(s.belt - 0.1)],
    [half, Y(clr + 0.25)],
    [half * 0.985, Y(clr + 0.08)],
    [half * 0.9, Y(clr)],
  ];
  const lowerPath = `${catmullRom(lower, 0.4)} Z`;

  const cabin = [
    [-half * s.glassW, beltY + 2],
    [-half * (s.glassW * 0.55 + s.roofW * 0.45), Y((s.belt + 1) / 2)],
    [-half * s.roofW, Y(0.985)],
    [0, Y(1)],
    [half * s.roofW, Y(0.985)],
    [half * (s.glassW * 0.55 + s.roofW * 0.45), Y((s.belt + 1) / 2)],
    [half * s.glassW, beltY + 2],
  ];
  const cabinPath = `${catmullRom(cabin, 0.4)} Z`;
  const glassInset = 0.05 * W;
  const glass = [
    [-half * s.glassW + glassInset * 0.8, beltY - H * 0.012],
    [-half * s.roofW + glassInset * 0.6, Y(0.955)],
    [half * s.roofW - glassInset * 0.6, Y(0.955)],
    [half * s.glassW - glassInset * 0.8, beltY - H * 0.012],
  ];
  const glassPath = `M${glass.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' L')} Z`;

  const isFront = view === 'front';
  const lampY = Y(s.belt - (isFront ? 0.09 : 0.08));
  const lampW = W * (lampStyle === 'slim' ? 0.2 : 0.17);
  const lampH = H * (lampStyle === 'slim' ? 0.05 : 0.085);
  const lamps = [-1, 1]
    .map((side) => {
      const outer = side * half * 0.9;
      const inner = side * (half * 0.9 - lampW);
      const top = lampY - lampH / 2;
      const bottom = lampY + lampH / 2;
      const d = `M${fmt(inner)},${fmt(top + lampH * 0.25)} L${fmt(outer)},${fmt(top)} L${fmt(outer - side * W * 0.01)},${fmt(bottom)} L${fmt(inner + side * W * 0.02)},${fmt(bottom)} Z`;
      const fill = isFront ? `url(#${id}hl)` : `url(#${id}tl)`;
      const detail = isFront
        ? `<path d="M${fmt(inner + side * W * 0.01)},${fmt(top + lampH * 0.3)} L${fmt(outer - side * W * 0.012)},${fmt(top + lampH * 0.1)}" stroke="#fff" stroke-width="${fmt(H * 0.008)}" stroke-linecap="round"/><circle cx="${fmt(outer - side * lampW * 0.3)}" cy="${fmt(lampY + lampH * 0.1)}" r="${fmt(lampH * 0.28)}" fill="#e9eef3" stroke="#8a949e" stroke-width="2"/>`
        : `<path d="M${fmt(inner + side * W * 0.01)},${fmt(lampY)} L${fmt(outer - side * W * 0.012)},${fmt(lampY - lampH * 0.1)}" stroke="#ff8a8f" stroke-width="${fmt(H * 0.006)}" stroke-linecap="round" opacity="0.9"/>`;
      return `<path d="${d}" fill="${fill}" stroke="#202225" stroke-width="2"/>${detail}`;
    })
    .join('');

  let grille = '';
  if (isFront) {
    const gTop = Y(s.belt - 0.13);
    const gBot = Y(s.belt - 0.26);
    const gw = W * (grilleStyle === 'wide' ? 0.5 : 0.4);
    const gPath = `M${fmt(-gw / 2)},${fmt(gTop)} L${fmt(gw / 2)},${fmt(gTop)} L${fmt(gw / 2 - W * 0.03)},${fmt(gBot)} L${fmt(-gw / 2 + W * 0.03)},${fmt(gBot)} Z`;
    let pattern = '';
    if (grilleStyle === 'mesh') {
      for (let y = gTop + 8; y < gBot - 4; y += H * 0.022) {
        for (let x = -gw / 2 + 10; x < gw / 2 - 10; x += W * 0.024) {
          pattern += `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(W * 0.014)}" height="${fmt(H * 0.01)}" rx="2" fill="#3a3d41" transform="skewX(-12)"/>`;
        }
      }
    } else {
      for (let y = gTop + H * 0.02; y < gBot - 4; y += H * 0.028) {
        pattern += `<rect x="${fmt(-gw / 2 + W * 0.02)}" y="${fmt(y)}" width="${fmt(gw - W * 0.04)}" height="${fmt(H * 0.007)}" rx="2" fill="${grilleStyle === 'chrome' ? '#c9cdd1' : '#3c3f43'}"/>`;
      }
    }
    grille = `<path d="${gPath}" fill="#121315" stroke="${grilleStyle === 'chrome' ? '#d9dde1' : '#2a2c2f'}" stroke-width="${fmt(W * 0.006)}"/><g clip-path="url(#${id}gc)">${pattern}</g>`;
    grille =
      grille.replace('</g>', '</g>') + `<clipPath id="${id}gc"><path d="${gPath}"/></clipPath>`;
    grille += `<path d="M${fmt(-W * 0.34)},${fmt(Y(clr + 0.06))} L${fmt(W * 0.34)},${fmt(Y(clr + 0.06))} L${fmt(W * 0.3)},${fmt(Y(clr + 0.14))} L${fmt(-W * 0.3)},${fmt(Y(clr + 0.14))} Z" fill="#161719"/>`;
    grille += [-1, 1]
      .map(
        (side) =>
          `<rect x="${fmt(side * W * 0.38 - W * 0.035)}" y="${fmt(Y(clr + 0.12))}" width="${fmt(W * 0.07)}" height="${fmt(H * 0.03)}" rx="${fmt(H * 0.012)}" fill="#dfe6ec" stroke="#4d5359" stroke-width="2"/>`,
      )
      .join('');
  } else {
    grille = `<rect x="${fmt(-W * 0.36)}" y="${fmt(Y(clr + 0.1))}" width="${fmt(W * 0.72)}" height="${fmt(H * 0.05)}" rx="${fmt(H * 0.02)}" fill="#1a1b1d"/>`;
    grille += [-1, 1]
      .map(
        (side) =>
          `<rect x="${fmt(side * W * 0.4 - W * 0.03)}" y="${fmt(Y(clr + 0.12))}" width="${fmt(W * 0.06)}" height="${fmt(H * 0.016)}" rx="4" fill="#b3121b"/>`,
      )
      .join('');
  }

  const plateMarkup = plateMask
    ? plate(0, Y(isFront ? clr + 0.19 : s.belt - 0.24), W * 0.26, H * 0.065)
    : '';

  const mirrors =
    isFront || true
      ? [-1, 1]
          .map((side) => {
            const x = side * half * (s.glassW + 0.1);
            const y = beltY - H * 0.01;
            return `<path d="M${fmt(x)},${fmt(y)} L${fmt(x + side * W * 0.1)},${fmt(y - H * 0.04)} L${fmt(x + side * W * 0.11)},${fmt(y + H * 0.02)} L${fmt(x + side * W * 0.01)},${fmt(y + H * 0.03)} Z" fill="url(#${id}b)" stroke="${paint.dark}" stroke-width="2"/>`;
          })
          .join('')
      : '';

  const rearDetails = isFront
    ? ''
    : `<rect x="${fmt(-W * 0.18)}" y="${fmt(Y(s.belt - 0.03))}" width="${fmt(W * 0.36)}" height="${fmt(H * 0.012)}" rx="4" fill="${mix(paint.base, '#000000', 0.3)}"/>` +
      (body === 'HATCHBACK' || body === 'SUV' || body === 'MUV'
        ? `<path d="M${fmt(-W * 0.02)},${fmt(beltY - H * 0.03)} L${fmt(-W * 0.2)},${fmt(Y(0.84))}" stroke="#0b0c0d" stroke-width="${fmt(H * 0.01)}" stroke-linecap="round"/>`
        : '');

  const hoodHighlight = `<path d="M${fmt(-half * 0.8)},${fmt(Y(s.belt - 0.035))} Q0,${fmt(Y(s.belt + 0.01))} ${fmt(half * 0.8)},${fmt(Y(s.belt - 0.035))}" fill="none" stroke="${paint.light}" stroke-width="${fmt(H * 0.01)}" opacity="0.7"/>`;

  const defs = [
    linear(`${id}b`, [
      [0, paint.light],
      [0.35, paint.base],
      [0.7, mix(paint.base, paint.dark, 0.45)],
      [1, paint.dark],
    ]),
    linear(
      `${id}sides`,
      [
        [0, '#000', 0.3],
        [0.12, '#000', 0],
        [0.88, '#000', 0],
        [1, '#000', 0.3],
      ],
      { x1: 0, y1: 0, x2: 1, y2: 0 },
    ),
    linear(`${id}g`, [
      [0, '#55606b'],
      [0.35, '#232a31'],
      [1, '#0b0e11'],
    ]),
    linear(
      `${id}gr`,
      [
        [0, '#fff', 0],
        [0.35, '#fff', 0.22],
        [0.42, '#fff', 0.04],
        [0.6, '#fff', 0.1],
        [1, '#fff', 0],
      ],
      { x1: 0, y1: 0, x2: 1, y2: 0.3 },
    ),
    linear(`${id}ty`, [
      [0, '#202123'],
      [1, '#0c0c0d'],
    ]),
    linear(
      `${id}hl`,
      [
        [0, '#f8fbff'],
        [0.55, '#c3cfda'],
        [1, '#6f7b87'],
      ],
      { x1: 0, y1: 0, x2: 1, y2: 1 },
    ),
    linear(`${id}tl`, [
      [0, '#ff5a60'],
      [0.55, '#c0121b'],
      [1, '#62060b'],
    ]),
    `<clipPath id="${id}lc"><path d="${lowerPath}"/></clipPath>`,
  ].join('');

  const markup = [
    tyres,
    `<path d="${cabinPath}" fill="url(#${id}b)"/>`,
    `<path d="${glassPath}" fill="url(#${id}g)" stroke="#0e0f10" stroke-width="3" stroke-linejoin="round"/>`,
    `<path d="${glassPath}" fill="url(#${id}gr)"/>`,
    mirrors,
    `<path d="${lowerPath}" fill="url(#${id}b)"/>`,
    `<g clip-path="url(#${id}lc)"><rect x="${fmt(-half * 1.1)}" y="${fmt(Y(1))}" width="${fmt(W * 1.1)}" height="${fmt(H)}" fill="url(#${id}sides)"/><rect x="${fmt(-half * 1.1)}" y="${fmt(Y(clr + 0.05))}" width="${fmt(W * 1.1)}" height="${fmt(H * 0.05)}" fill="#1c1d1f"/></g>`,
    isFront ? hoodHighlight : '',
    grille,
    lamps,
    rearDetails,
    plateMarkup,
  ].join('');

  return { defs, body: markup, width: W, height: H, belt: s.belt - 0.09 };
}
