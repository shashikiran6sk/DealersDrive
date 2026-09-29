import { catmullRom, fmt, linear, mix, radial, uid } from './svg.mjs';

export const BODY_SPECS = {
  HATCHBACK: {
    length: 1240,
    wheelR: 0.083,
    front: 0.165,
    rear: 0.805,
    sill: 0.058,
    top: [
      [0.012, 0.09],
      [0.0, 0.14],
      [0.006, 0.2],
      [0.035, 0.228],
      [0.17, 0.25],
      [0.3, 0.272],
      [0.39, 0.34],
      [0.47, 0.393],
      [0.66, 0.402],
      [0.84, 0.39],
      [0.905, 0.35],
      [0.955, 0.305],
      [0.985, 0.26],
      [0.997, 0.2],
      [0.996, 0.12],
      [0.985, 0.09],
    ],
    glass: [
      [0.335, 0.278],
      [0.475, 0.379],
      [0.66, 0.387],
      [0.8, 0.377],
      [0.845, 0.302],
    ],
    pillars: [0.56],
    blackPillars: [],
    rails: false,
    cladding: false,
  },
  SEDAN: {
    length: 1480,
    wheelR: 0.072,
    front: 0.17,
    rear: 0.775,
    sill: 0.052,
    top: [
      [0.012, 0.08],
      [0.0, 0.125],
      [0.006, 0.165],
      [0.04, 0.195],
      [0.18, 0.215],
      [0.315, 0.238],
      [0.4, 0.29],
      [0.48, 0.334],
      [0.6, 0.338],
      [0.69, 0.328],
      [0.78, 0.285],
      [0.845, 0.252],
      [0.93, 0.246],
      [0.985, 0.238],
      [0.998, 0.21],
      [0.997, 0.13],
      [0.985, 0.08],
    ],
    glass: [
      [0.35, 0.244],
      [0.484, 0.322],
      [0.6, 0.326],
      [0.683, 0.316],
      [0.775, 0.266],
      [0.8, 0.254],
    ],
    pillars: [0.555],
    blackPillars: [],
    rails: false,
    cladding: false,
  },
  SUV: {
    length: 1420,
    wheelR: 0.086,
    front: 0.165,
    rear: 0.8,
    sill: 0.07,
    top: [
      [0.012, 0.1],
      [0.0, 0.16],
      [0.006, 0.225],
      [0.035, 0.258],
      [0.17, 0.28],
      [0.29, 0.305],
      [0.36, 0.35],
      [0.435, 0.392],
      [0.65, 0.398],
      [0.9, 0.387],
      [0.955, 0.375],
      [0.982, 0.34],
      [0.997, 0.26],
      [0.996, 0.14],
      [0.985, 0.1],
    ],
    glass: [
      [0.325, 0.312],
      [0.442, 0.378],
      [0.65, 0.384],
      [0.89, 0.373],
      [0.935, 0.334],
    ],
    pillars: [0.55, 0.765],
    blackPillars: [0.55],
    rails: true,
    cladding: true,
  },
  MUV: {
    length: 1540,
    wheelR: 0.075,
    front: 0.158,
    rear: 0.765,
    sill: 0.058,
    top: [
      [0.012, 0.09],
      [0.0, 0.14],
      [0.006, 0.2],
      [0.035, 0.235],
      [0.16, 0.258],
      [0.27, 0.284],
      [0.34, 0.33],
      [0.415, 0.376],
      [0.65, 0.382],
      [0.93, 0.372],
      [0.97, 0.36],
      [0.99, 0.32],
      [0.998, 0.25],
      [0.997, 0.13],
      [0.985, 0.09],
    ],
    glass: [
      [0.305, 0.29],
      [0.422, 0.363],
      [0.65, 0.369],
      [0.922, 0.359],
      [0.962, 0.302],
    ],
    pillars: [0.5, 0.74],
    blackPillars: [0.5, 0.74],
    rails: true,
    cladding: false,
  },
  LUXURY: {
    length: 1560,
    wheelR: 0.076,
    front: 0.17,
    rear: 0.77,
    sill: 0.052,
    top: [
      [0.012, 0.08],
      [0.0, 0.125],
      [0.006, 0.17],
      [0.045, 0.2],
      [0.2, 0.218],
      [0.335, 0.235],
      [0.42, 0.278],
      [0.5, 0.312],
      [0.62, 0.316],
      [0.715, 0.304],
      [0.8, 0.262],
      [0.86, 0.24],
      [0.94, 0.237],
      [0.99, 0.228],
      [0.998, 0.2],
      [0.997, 0.13],
      [0.985, 0.08],
    ],
    glass: [
      [0.37, 0.241],
      [0.502, 0.3],
      [0.62, 0.304],
      [0.708, 0.293],
      [0.8, 0.249],
      [0.815, 0.243],
    ],
    pillars: [0.58],
    blackPillars: [],
    rails: false,
    cladding: false,
  },
};

export function wheel({
  cx,
  cy,
  r,
  style = 'five',
  tone = 'silver',
  rotate = 0,
  brake = '#5c6167',
}) {
  const id = uid('wh');
  const rim = r * 0.7;
  const metal =
    tone === 'dark'
      ? ['#5b6066', '#2e3135', '#1b1d20']
      : tone === 'steel'
        ? ['#d0d3d6', '#9ea3a8', '#6e7378']
        : ['#f2f3f5', '#b8bdc2', '#7c8288'];
  const defs = [
    radial(`${id}t`, [
      [0, '#2a2b2d'],
      [0.72, '#1c1d1f'],
      [0.86, '#2d2e31'],
      [0.95, '#1a1b1d'],
      [1, '#0d0e0f'],
    ]),
    linear(
      `${id}m`,
      [
        [0, metal[0]],
        [0.55, metal[1]],
        [1, metal[2]],
      ],
      { x1: 0.2, y1: 0, x2: 0.8, y2: 1 },
    ),
    radial(`${id}d`, [
      [0, '#8b9095'],
      [0.8, '#5a5f64'],
      [1, '#3b3e42'],
    ]),
  ].join('');
  let spokes = '';
  const count = style === 'ten' ? 10 : style === 'multi' ? 15 : style === 'cover' ? 12 : 5;
  const inner = rim * 0.26;
  const p = (ang, rad) => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
  for (let i = 0; i < count; i += 1) {
    const a = ((i / count) * 360 + rotate) * (Math.PI / 180);
    const spread =
      style === 'five' ? 0.2 : style === 'multi' ? 0.06 : style === 'cover' ? 0.09 : 0.1;
    const outerSpread = style === 'five' ? 0.16 : spread * 0.9;
    const a1 = p(a - spread, inner);
    const a2 = p(a + spread, inner);
    const b1 = p(a + outerSpread, rim * 0.93);
    const b2 = p(a - outerSpread, rim * 0.93);
    spokes += `<path d="M${fmt(a1[0])},${fmt(a1[1])} L${fmt(b2[0])},${fmt(b2[1])} A${fmt(rim * 0.93)},${fmt(rim * 0.93)} 0 0 1 ${fmt(b1[0])},${fmt(b1[1])} L${fmt(a2[0])},${fmt(a2[1])} Z" fill="url(#${id}m)" stroke="${metal[2]}" stroke-width="${fmt(r * 0.012)}"/>`;
    if (style === 'five') {
      const c1 = p(a - 0.04, inner * 1.2);
      const c2 = p(a + 0.04, inner * 1.2);
      const d1 = p(a + 0.03, rim * 0.9);
      const d2 = p(a - 0.03, rim * 0.9);
      spokes += `<path d="M${fmt(c1[0])},${fmt(c1[1])} L${fmt(d2[0])},${fmt(d2[1])} L${fmt(d1[0])},${fmt(d1[1])} L${fmt(c2[0])},${fmt(c2[1])} Z" fill="#000" opacity="0.18"/>`;
    }
    if (style === 'cover') {
      const s1 = p(a + 0.13, rim * 0.45);
      const s2 = p(a + 0.13, rim * 0.85);
      spokes += `<path d="M${fmt(s1[0])},${fmt(s1[1])} L${fmt(s2[0])},${fmt(s2[1])}" stroke="#2a2c2f" stroke-width="${fmt(rim * 0.07)}" stroke-linecap="round" opacity="0.8"/>`;
    }
  }
  const lugs = Array.from({ length: 5 }, (_, i) => {
    const [x, y] = p(((i / 5) * 360 + rotate + 36) * (Math.PI / 180), inner * 0.72);
    return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(inner * 0.1)}" fill="${metal[2]}"/>`;
  }).join('');
  const body = [
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="url(#${id}t)"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r * 0.9)}" fill="none" stroke="#35373a" stroke-width="${fmt(r * 0.012)}"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(rim)}" fill="#0e0f10"/>`,
    style === 'cover'
      ? ''
      : `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(rim * 0.78)}" fill="url(#${id}d)"/>`,
    style === 'cover'
      ? ''
      : `<rect x="${fmt(cx + rim * 0.28)}" y="${fmt(cy - rim * 0.62)}" width="${fmt(rim * 0.3)}" height="${fmt(rim * 0.42)}" rx="${fmt(rim * 0.08)}" fill="${brake}" transform="rotate(-18 ${fmt(cx)} ${fmt(cy)})"/>`,
    style === 'cover'
      ? `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(rim * 0.97)}" fill="url(#${id}m)"/>`
      : '',
    spokes,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(rim)}" fill="none" stroke="url(#${id}m)" stroke-width="${fmt(rim * 0.07)}"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(inner * 1.05)}" fill="url(#${id}m)"/>`,
    lugs,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(inner * 0.45)}" fill="${metal[1]}" stroke="${metal[2]}" stroke-width="1"/>`,
  ].join('');
  return { defs, body };
}

export function carSide({
  body = 'SUV',
  paint,
  wheelStyle = 'five',
  wheelTone = 'silver',
  scale = 1,
}) {
  const s = BODY_SPECS[body] ?? BODY_SPECS.SUV;
  const L = s.length * scale;
  const X = (f) => f * L;
  const Y = (h) => -h * L;
  const P = ([f, h]) => [X(f), Y(h)];
  const id = uid('car');
  const R = s.wheelR * L;
  const archR = R * 1.15;
  const fx = X(s.front);
  const rx = X(s.rear);
  const sill = Y(s.sill);

  const arch = (cx) =>
    `L${fmt(cx + archR)},${fmt(sill)} A${fmt(archR)},${fmt(archR)} 0 0 0 ${fmt(cx - archR)},${fmt(sill)}`;
  const outline = `${catmullRom(s.top.map(P), 0.5)} L${fmt(X(0.975))},${fmt(sill)} ${arch(rx)} ${arch(fx)} L${fmt(X(0.02))},${fmt(sill)} Z`;

  const g0 = s.glass[0];
  const gN = s.glass.at(-1);
  const beltAt = (f) => Y(g0[1] + ((gN[1] - g0[1]) * (f - g0[0])) / (gN[0] - g0[0]));
  const glassPath = `${catmullRom(s.glass.map(P), 0.35)} Z`;

  const pillarMarkup = s.pillars
    .map((f) => {
      const w = 0.024;
      const fill = s.blackPillars.includes(f) ? '#111214' : `url(#${id}b)`;
      return `<path d="M${fmt(X(f))},${fmt(beltAt(f) + 4)} L${fmt(X(f + w))},${fmt(beltAt(f + w) + 4)} L${fmt(X(f + w - 0.016))},${fmt(Y(0.6))} L${fmt(X(f - 0.016))},${fmt(Y(0.6))} Z" fill="${fill}"/>`;
    })
    .join('');

  const doorFront = g0[0] - 0.012;
  const doorMid = s.pillars[0] + 0.012;
  const doorRear = body === 'SEDAN' || body === 'LUXURY' ? s.rear - 0.03 : s.rear - 0.06;
  const doorLine = (f, bottomShift = 0) =>
    `M${fmt(X(f))},${fmt(beltAt(f) + 2)} C${fmt(X(f + 0.004))},${fmt(beltAt(f) + (sill - beltAt(f)) * 0.5)} ${fmt(X(f + bottomShift))},${fmt(sill - L * 0.02)} ${fmt(X(f + bottomShift))},${fmt(sill - L * 0.004)}`;

  const shoulderY = beltAt((g0[0] + gN[0]) / 2) + L * 0.022;
  const nose = s.top[3];
  const tailTop = s.top.filter(([f, h]) => f > 0.9 && f < 0.99 && h > 0.2).at(-1) ?? s.top.at(-4);
  const crease = catmullRom(
    [
      [X(0.05), Y(nose[1] - 0.014)],
      [X(g0[0]), beltAt(g0[0]) + L * 0.024],
      [X(gN[0]), beltAt(gN[0]) + L * 0.02],
      [X(0.975), Y(tailTop[1] - 0.035)],
    ],
    0.5,
  );

  const handleY = (f) => beltAt(f) + L * 0.03;
  const handles = [doorMid - 0.06, doorRear - 0.045]
    .map(
      (f) =>
        `<rect x="${fmt(X(f))}" y="${fmt(handleY(f))}" width="${fmt(L * 0.036)}" height="${fmt(L * 0.008)}" rx="${fmt(L * 0.004)}" fill="${paint.dark}" opacity="0.55"/><rect x="${fmt(X(f) + 1)}" y="${fmt(handleY(f))}" width="${fmt(L * 0.034)}" height="${fmt(L * 0.003)}" rx="${fmt(L * 0.002)}" fill="#fff" opacity="0.35"/>`,
    )
    .join('');

  const mirrorX = X(g0[0] + 0.012);
  const mirrorY = beltAt(g0[0]) - L * 0.006;
  const mirror = `<path d="M${fmt(mirrorX)},${fmt(mirrorY + L * 0.012)} C${fmt(mirrorX - L * 0.004)},${fmt(mirrorY - L * 0.014)} ${fmt(mirrorX + L * 0.03)},${fmt(mirrorY - L * 0.026)} ${fmt(mirrorX + L * 0.048)},${fmt(mirrorY - L * 0.01)} L${fmt(mirrorX + L * 0.044)},${fmt(mirrorY + L * 0.012)} Z" fill="url(#${id}b)" stroke="${paint.dark}" stroke-width="1"/>`;

  const lampY = Y(nose[1] - 0.008);
  const headlamp = `<path d="M${fmt(X(0.006))},${fmt(Y(s.top[2][1] - 0.006))} C${fmt(X(0.02))},${fmt(lampY - L * 0.004)} ${fmt(X(0.06))},${fmt(lampY)} ${fmt(X(0.115))},${fmt(lampY + L * 0.005)} C${fmt(X(0.085))},${fmt(lampY + L * 0.022)} ${fmt(X(0.03))},${fmt(Y(s.top[2][1] - 0.022))} ${fmt(X(0.008))},${fmt(Y(s.top[2][1] - 0.024))} Z" fill="url(#${id}h)" stroke="#2b2f33" stroke-width="1.2"/>`;
  const drl = `<path d="M${fmt(X(0.014))},${fmt(Y(s.top[2][1] - 0.008))} C${fmt(X(0.04))},${fmt(lampY + L * 0.002)} ${fmt(X(0.07))},${fmt(lampY + L * 0.004)} ${fmt(X(0.105))},${fmt(lampY + L * 0.008)}" stroke="#ffffff" stroke-width="${fmt(L * 0.0035)}" fill="none" stroke-linecap="round" opacity="0.95"/>`;
  const grille = `<path d="M${fmt(X(0.002))},${fmt(Y(0.155))} L${fmt(X(0.03))},${fmt(Y(0.16))} L${fmt(X(0.028))},${fmt(Y(0.11))} L${fmt(X(0.006))},${fmt(Y(0.105))} Z" fill="#141517" opacity="0.85"/>`;

  const tY = Y(tailTop[1] - 0.008);
  const tX = X(tailTop[0] - 0.04);
  const taillamp = `<path d="M${fmt(tX)},${fmt(tY)} L${fmt(X(0.994))},${fmt(tY + L * 0.006)} L${fmt(X(0.995))},${fmt(tY + L * 0.03)} C${fmt(X(0.97))},${fmt(tY + L * 0.03)} ${fmt(tX + L * 0.012)},${fmt(tY + L * 0.022)} ${fmt(tX)},${fmt(tY)} Z" fill="url(#${id}r)" stroke="#3a0c10" stroke-width="1"/><rect x="${fmt(X(0.975))}" y="${fmt(Y(0.13))}" width="${fmt(L * 0.02)}" height="${fmt(L * 0.007)}" rx="2" fill="#a3141c"/>`;

  const claddingPath = s.cladding
    ? `<path d="M${fmt(X(0.012))},${fmt(sill - L * 0.026)} L${fmt(X(0.99))},${fmt(sill - L * 0.026)} L${fmt(X(0.985))},${fmt(sill)} L${fmt(X(0.02))},${fmt(sill)} Z" fill="#232527"/>` +
      [fx, rx]
        .map(
          (cx) =>
            `<path d="M${fmt(cx - archR - L * 0.014)},${fmt(sill)} A${fmt(archR + L * 0.014)},${fmt(archR + L * 0.014)} 0 0 1 ${fmt(cx + archR + L * 0.014)},${fmt(sill)} L${fmt(cx + archR)},${fmt(sill)} A${fmt(archR)},${fmt(archR)} 0 0 0 ${fmt(cx - archR)},${fmt(sill)} Z" fill="#232527"/>`,
        )
        .join('') +
      `<path d="M${fmt(X(0.01))},${fmt(Y(0.12))} L${fmt(X(0.06))},${fmt(Y(0.115))}" stroke="#b9bec3" stroke-width="${fmt(L * 0.006)}" stroke-linecap="round"/>`
    : `<path d="M${fmt(X(0.03))},${fmt(sill - L * 0.009)} L${fmt(X(0.97))},${fmt(sill - L * 0.009)}" stroke="${paint.dark}" stroke-width="${fmt(L * 0.012)}" opacity="0.5"/>`;

  const railStart = s.glass[1][0] + 0.03;
  const railEnd = s.glass.at(-2)[0] - 0.01;
  const rails = s.rails
    ? `<path d="M${fmt(X(railStart))},${fmt(Y(0.4))} L${fmt(X(railEnd))},${fmt(Y(0.392))}" stroke="#1d1e20" stroke-width="${fmt(L * 0.008)}" stroke-linecap="round" transform="translate(0 ${fmt(-L * 0.004)})"/><path d="M${fmt(X(railStart))},${fmt(Y(0.4))} L${fmt(X(railEnd))},${fmt(Y(0.392))}" stroke="#7b7f84" stroke-width="${fmt(L * 0.002)}" transform="translate(0 ${fmt(-L * 0.006)})"/>`
    : '';

  const w1 = wheel({ cx: fx, cy: -R, r: R, style: wheelStyle, tone: wheelTone, rotate: 11 });
  const w2 = wheel({ cx: rx, cy: -R, r: R, style: wheelStyle, tone: wheelTone, rotate: 37 });

  const defs = [
    linear(
      `${id}b`,
      [
        [0, paint.light],
        [0.28, paint.base],
        [0.5, paint.base],
        [0.64, mix(paint.base, paint.dark, 0.4)],
        [1, paint.dark],
      ],
      { x1: 0, y1: 0, x2: 0, y2: 1 },
    ),
    linear(
      `${id}ends`,
      [
        [0, '#000', 0.28],
        [0.06, '#000', 0],
        [0.94, '#000', 0],
        [1, '#000', 0.32],
      ],
      { x1: 0, y1: 0, x2: 1, y2: 0 },
    ),
    linear(
      `${id}g`,
      [
        [0, '#48515b'],
        [0.4, '#1d232a'],
        [1, '#0a0d10'],
      ],
      { x1: 0, y1: 0, x2: 0.2, y2: 1 },
    ),
    linear(
      `${id}gr`,
      [
        [0, '#ffffff', 0],
        [0.42, '#ffffff', 0.2],
        [0.5, '#ffffff', 0.05],
        [0.62, '#ffffff', 0.12],
        [1, '#ffffff', 0],
      ],
      { x1: 0, y1: 0, x2: 1, y2: 0.45 },
    ),
    linear(
      `${id}sheen`,
      [
        [0, '#ffffff', 0],
        [0.5, '#ffffff', 0.3],
        [1, '#ffffff', 0],
      ],
      { x1: 0, y1: 0, x2: 0, y2: 1 },
    ),
    linear(
      `${id}low`,
      [
        [0, '#000', 0],
        [1, '#000', 0.25],
      ],
      { x1: 0, y1: 0, x2: 0, y2: 1 },
    ),
    linear(
      `${id}h`,
      [
        [0, '#f6fbff'],
        [0.5, '#c9d6e2'],
        [1, '#7b8793'],
      ],
      { x1: 0, y1: 0, x2: 1, y2: 1 },
    ),
    linear(
      `${id}r`,
      [
        [0, '#ff5a5f'],
        [0.5, '#c4121c'],
        [1, '#6f070c'],
      ],
      { x1: 0, y1: 0, x2: 0, y2: 1 },
    ),
    `<clipPath id="${id}clip"><path d="${outline}"/></clipPath>`,
    `<clipPath id="${id}gclip"><path d="${glassPath}"/></clipPath>`,
    w1.defs,
    w2.defs,
  ].join('');

  const bodyMarkup = [
    [fx, rx]
      .map(
        (cx) => `<circle cx="${fmt(cx)}" cy="${fmt(-R)}" r="${fmt(archR * 0.99)}" fill="#0c0d0e"/>`,
      )
      .join(''),
    `<g>${w1.body}${w2.body}</g>`,
    `<path d="${outline}" fill="url(#${id}b)"/>`,
    `<g clip-path="url(#${id}clip)">`,
    `<rect x="${fmt(X(-0.1))}" y="${fmt(shoulderY - L * 0.035)}" width="${fmt(L * 1.2)}" height="${fmt(L * 0.07)}" fill="url(#${id}sheen)"/>`,
    `<rect x="0" y="${fmt(Y(0.16))}" width="${fmt(L)}" height="${fmt(L * 0.11)}" fill="url(#${id}low)"/>`,
    `<rect x="0" y="${fmt(Y(0.5))}" width="${fmt(L)}" height="${fmt(L * 0.5)}" fill="url(#${id}ends)"/>`,
    `<path d="${crease}" fill="none" stroke="${paint.light}" stroke-width="${fmt(L * 0.003)}" opacity="0.75"/>`,
    `<path d="${crease}" fill="none" stroke="${paint.dark}" stroke-width="${fmt(L * 0.002)}" opacity="0.35" transform="translate(0 ${fmt(L * 0.004)})"/>`,
    `<path d="${doorLine(doorFront, -0.004)}" fill="none" stroke="${paint.dark}" stroke-width="1.4" opacity="0.7"/>`,
    `<path d="${doorLine(doorMid)}" fill="none" stroke="${paint.dark}" stroke-width="1.4" opacity="0.7"/>`,
    `<path d="${doorLine(doorRear, 0.01)}" fill="none" stroke="${paint.dark}" stroke-width="1.4" opacity="0.7"/>`,
    claddingPath,
    grille,
    `</g>`,
    `<path d="${glassPath}" fill="url(#${id}g)" stroke="#101112" stroke-width="${fmt(L * 0.005)}" stroke-linejoin="round"/>`,
    `<g clip-path="url(#${id}gclip)">${pillarMarkup}<path d="${glassPath}" fill="url(#${id}gr)"/></g>`,
    rails,
    mirror,
    headlamp,
    drl,
    taillamp,
    handles,
  ].join('');

  return {
    defs,
    body: bodyMarkup,
    length: L,
    height: Math.max(...s.top.map(([, h]) => h)) * L,
    wheelR: R,
    front: fx,
    rear: rx,
  };
}
