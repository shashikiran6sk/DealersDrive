import { paintFor } from './colors.mjs';
import { carFront } from './car-front.mjs';
import { carSide } from './car-side.mjs';
import { rngFor } from './rng.mjs';
import { blur, catmullRom, fmt, linear, mix, radial, svgDoc, uid } from './svg.mjs';

export const YARD_W = 2400;
export const YARD_H = 1200;

const SKIES = {
  morning: { top: '#9cc3e6', bottom: '#eaf3fa', haze: '#dce7ef', light: '#fff7e8', tint: 0.0 },
  midday: { top: '#6fa9dd', bottom: '#dcecf8', haze: '#cfe0ee', light: '#ffffff', tint: 0.0 },
  golden: { top: '#8fb2d4', bottom: '#f6dcb8', haze: '#ecd9c0', light: '#ffd9a3', tint: 0.08 },
};

const ACCENTS = [
  '#0f6e5c',
  '#7a1f2b',
  '#1d3f73',
  '#2d6a2f',
  '#b45a12',
  '#2b2f36',
  '#5a2d82',
  '#0d5b7a',
];
const WALLS = ['#f1ece2', '#e9e4da', '#f4efe6', '#e3e7ea', '#efe6d6', '#e8e0d2'];
const CAR_COLORS = [
  'WHITE',
  'WHITE',
  'SILVER',
  'GREY',
  'RED',
  'BLUE',
  'BLACK',
  'WHITE',
  'SILVER',
  'BROWN',
  'BEIGE',
  'ORANGE',
];
const BODIES = ['HATCHBACK', 'SEDAN', 'SUV', 'MUV', 'HATCHBACK', 'SUV'];

function palm(x, groundY, h, lean, rng, color = '#2f6b3a') {
  const trunk = catmullRom(
    [
      [x, groundY],
      [x + lean * 0.4, groundY - h * 0.5],
      [x + lean, groundY - h],
    ],
    0.5,
  );
  let fronds = '';
  const top = [x + lean, groundY - h];
  for (let i = 0; i < 9; i += 1) {
    const a = -Math.PI / 2 + (i - 4) * 0.38 + rng.between(-0.08, 0.08);
    const len = h * rng.between(0.3, 0.42);
    const mid = [top[0] + Math.cos(a) * len * 0.55, top[1] + Math.sin(a) * len * 0.55 - len * 0.12];
    const end = [top[0] + Math.cos(a) * len, top[1] + Math.sin(a) * len + len * 0.35];
    fronds += `<path d="M${fmt(top[0])},${fmt(top[1])} Q${fmt(mid[0])},${fmt(mid[1])} ${fmt(end[0])},${fmt(end[1])}" stroke="${color}" stroke-width="${fmt(h * 0.035)}" fill="none" stroke-linecap="round"/>`;
    fronds += `<path d="M${fmt(top[0])},${fmt(top[1])} Q${fmt(mid[0])},${fmt(mid[1] + h * 0.02)} ${fmt(end[0])},${fmt(end[1])}" stroke="${mix(color, '#000000', 0.25)}" stroke-width="${fmt(h * 0.012)}" fill="none" stroke-dasharray="${fmt(h * 0.02)} ${fmt(h * 0.012)}"/>`;
  }
  return `<path d="${trunk}" stroke="#7a6048" stroke-width="${fmt(h * 0.035)}" fill="none" stroke-linecap="round"/>${fronds}<circle cx="${fmt(top[0])}" cy="${fmt(top[1] + h * 0.02)}" r="${fmt(h * 0.03)}" fill="#6b5a2a"/>`;
}

function roundTree(x, groundY, h, rng, color = '#3f7a45') {
  let blobs = '';
  for (let i = 0; i < 7; i += 1) {
    const bx = x + rng.between(-h * 0.35, h * 0.35);
    const by = groundY - h * rng.between(0.55, 0.9);
    const r = h * rng.between(0.18, 0.3);
    blobs += `<circle cx="${fmt(bx)}" cy="${fmt(by)}" r="${fmt(r)}" fill="${mix(color, i % 2 ? '#000000' : '#ffffff', rng.between(0.02, 0.14))}"/>`;
  }
  return `<path d="M${fmt(x)},${fmt(groundY)} L${fmt(x)},${fmt(groundY - h * 0.55)}" stroke="#5e4a3a" stroke-width="${fmt(h * 0.06)}"/>${blobs}`;
}

function skyline(y, rng, haze) {
  let out = '';
  let x = -20;
  while (x < YARD_W) {
    const w = rng.between(90, 220);
    const h = rng.between(60, 190);
    const tone = mix(haze, '#8a9aa8', rng.between(0.15, 0.35));
    out += `<rect x="${fmt(x)}" y="${fmt(y - h)}" width="${fmt(w)}" height="${fmt(h + 4)}" fill="${tone}"/>`;
    for (let wy = y - h + 16; wy < y - 16; wy += 26) {
      for (let wx = x + 12; wx < x + w - 16; wx += 24) {
        if (rng.chance(0.7))
          out += `<rect x="${fmt(wx)}" y="${fmt(wy)}" width="10" height="12" fill="${mix(tone, '#ffffff', 0.25)}"/>`;
      }
    }
    if (rng.chance(0.18)) {
      const tx = x + w * 0.5;
      const th = rng.between(70, 110);
      out += `<rect x="${fmt(tx - 36)}" y="${fmt(y - h - th)}" width="72" height="44" rx="6" fill="${tone}"/><path d="M${fmt(tx - 30)},${fmt(y - h - th + 44)} L${fmt(tx - 22)},${fmt(y - h)} M${fmt(tx + 30)},${fmt(y - h - th + 44)} L${fmt(tx + 22)},${fmt(y - h)}" stroke="${tone}" stroke-width="7"/>`;
    }
    x += w + rng.between(-10, 30);
  }
  return out;
}

function glassPanels(x, y, w, h, cols, id) {
  let out = `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="url(#${id}glass)"/>`;
  out += `<rect x="${fmt(x)}" y="${fmt(y + h * 0.55)}" width="${fmt(w)}" height="${fmt(h * 0.45)}" fill="#1d2a33" opacity="0.35"/>`;
  for (let i = 1; i < cols; i += 1) {
    out += `<rect x="${fmt(x + (w * i) / cols - 4)}" y="${fmt(y)}" width="8" height="${fmt(h)}" fill="#3a4047"/>`;
  }
  out += `<path d="M${fmt(x + w * 0.1)},${fmt(y + h)} L${fmt(x + w * 0.35)},${fmt(y)} L${fmt(x + w * 0.45)},${fmt(y)} L${fmt(x + w * 0.2)},${fmt(y + h)} Z" fill="#fff" opacity="0.12"/>`;
  out += `<path d="M${fmt(x + w * 0.55)},${fmt(y + h)} L${fmt(x + w * 0.72)},${fmt(y)} L${fmt(x + w * 0.76)},${fmt(y)} L${fmt(x + w * 0.59)},${fmt(y + h)} Z" fill="#fff" opacity="0.1"/>`;
  return out;
}

function shutter(x, y, w, h) {
  let out = `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="#9aa1a8"/>`;
  for (let yy = y + 8; yy < y + h; yy += 14)
    out += `<rect x="${fmt(x)}" y="${fmt(yy)}" width="${fmt(w)}" height="3" fill="#7d848b"/>`;
  return out + `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="16" fill="#5b6168"/>`;
}

function windowWithChajja(x, y, w, h, wall) {
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="#3e4b56"/><rect x="${fmt(x + w / 2 - 3)}" y="${fmt(y)}" width="6" height="${fmt(h)}" fill="${wall}"/><rect x="${fmt(x)}" y="${fmt(y + h * 0.5 - 3)}" width="${fmt(w)}" height="6" fill="${wall}"/><rect x="${fmt(x - 16)}" y="${fmt(y - 18)}" width="${fmt(w + 32)}" height="14" fill="${mix(wall, '#000000', 0.18)}"/><rect x="${fmt(x - 16)}" y="${fmt(y - 4)}" width="${fmt(w + 32)}" height="8" fill="#000" opacity="0.12"/>`;
}

function building(style, cx, groundY, rng, accent, wall, id) {
  let out = '';
  if (style === 'glass' || style === 'premium') {
    const w = 1180;
    const h = style === 'premium' ? 420 : 360;
    const x = cx - w / 2;
    const y = groundY - h;
    const frame = style === 'premium' ? '#2a2d31' : mix(wall, '#ffffff', 0.3);
    out += `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${frame}"/>`;
    if (style === 'premium') {
      for (let i = 0; i < 8; i += 1)
        out += `<rect x="${fmt(x + i * (w / 8))}" y="${fmt(y)}" width="${fmt(w / 8 - 4)}" height="${fmt(h * 0.2)}" fill="${mix('#2a2d31', '#ffffff', 0.04 * (i % 2))}"/>`;
      out += `<rect x="${fmt(x)}" y="${fmt(y + h * 0.2)}" width="${fmt(w)}" height="6" fill="${accent}"/>`;
    } else {
      out += `<rect x="${fmt(x - 30)}" y="${fmt(y + h * 0.12)}" width="${fmt(w + 60)}" height="${fmt(h * 0.12)}" fill="${accent}"/>`;
      out += `<rect x="${fmt(x - 30)}" y="${fmt(y + h * 0.24)}" width="${fmt(w + 60)}" height="10" fill="#000" opacity="0.15"/>`;
    }
    out += glassPanels(x + 40, y + h * 0.28, w - 80, h * 0.72, 7, id);
    out += `<rect x="${fmt(x + w * 0.44)}" y="${fmt(y + h * 0.42)}" width="${fmt(w * 0.12)}" height="${fmt(h * 0.58)}" fill="#26323b" opacity="0.8"/>`;
  } else if (style === 'concrete' || style === 'urban') {
    const w = style === 'urban' ? 760 : 1000;
    const h = 460;
    const x = cx - w / 2;
    const y = groundY - h;
    if (style === 'urban') {
      const n1 = rng.pick(WALLS);
      const n2 = rng.pick(['#d9c7a8', '#c9d3c8', '#d8c2c2', '#c8d0da']);
      out +=
        `<rect x="${fmt(x - 520)}" y="${fmt(y + 60)}" width="520" height="${fmt(h - 60)}" fill="${n2}"/>` +
        windowWithChajja(x - 440, y + 120, 140, 110, n2) +
        windowWithChajja(x - 240, y + 120, 140, 110, n2) +
        shutter(x - 460, groundY - 180, 360, 180);
      out +=
        `<rect x="${fmt(x + w)}" y="${fmt(y + 30)}" width="520" height="${fmt(h - 30)}" fill="${n1}"/>` +
        windowWithChajja(x + w + 80, y + 100, 140, 110, n1) +
        windowWithChajja(x + w + 280, y + 100, 140, 110, n1) +
        shutter(x + w + 60, groundY - 180, 380, 180);
    }
    out += `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${wall}"/>`;
    out += `<rect x="${fmt(x - 10)}" y="${fmt(y - 24)}" width="${fmt(w + 20)}" height="30" fill="${mix(wall, '#000000', 0.12)}"/>`;
    out += `<rect x="${fmt(x)}" y="${fmt(y + h * 0.44)}" width="${fmt(w)}" height="${fmt(h * 0.1)}" fill="${accent}"/>`;
    out += `<rect x="${fmt(x)}" y="${fmt(y + h * 0.54)}" width="${fmt(w)}" height="10" fill="#000" opacity="0.14"/>`;
    const n = style === 'urban' ? 3 : 4;
    for (let i = 0; i < n; i += 1)
      out += windowWithChajja(
        x + 70 + i * ((w - 140) / n) + 20,
        y + 70,
        (w - 140) / n - 60,
        110,
        wall,
      );
    out += glassPanels(x + 50, groundY - h * 0.4, w * 0.42, h * 0.4, 3, id);
    out += shutter(x + w * 0.52, groundY - h * 0.4, w * 0.42, h * 0.4);
    out += `<rect x="${fmt(x + w * 0.8)}" y="${fmt(y + 190)}" width="70" height="46" rx="4" fill="#d9dde0" stroke="#9aa0a6" stroke-width="3"/><circle cx="${fmt(x + w * 0.8 + 24)}" cy="${fmt(y + 213)}" r="16" fill="none" stroke="#9aa0a6" stroke-width="3"/>`;
  } else if (style === 'kerala') {
    const w = 820;
    const h = 300;
    const x = cx - w / 2;
    const y = groundY - h;
    out += `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${wall}"/>`;
    out += `<path d="M${fmt(x - 90)},${fmt(y + 10)} L${fmt(x + 120)},${fmt(y - 170)} L${fmt(x + w - 120)},${fmt(y - 170)} L${fmt(x + w + 90)},${fmt(y + 10)} Z" fill="#a4462c"/>`;
    for (let i = 1; i < 9; i += 1) {
      const t = i / 9;
      out += `<path d="M${fmt(x - 90 + t * 210)},${fmt(y + 10 - t * 180)} L${fmt(x + w + 90 - t * 210)},${fmt(y + 10 - t * 180)}" stroke="#7f311d" stroke-width="4" opacity="0.8"/>`;
    }
    out += `<rect x="${fmt(x - 90)}" y="${fmt(y + 4)}" width="${fmt(w + 180)}" height="16" fill="#6b2a18"/>`;
    for (let i = 0; i < 5; i += 1)
      out += `<rect x="${fmt(x + 40 + i * ((w - 80) / 4) - 14)}" y="${fmt(y + 20)}" width="28" height="${fmt(h - 20)}" fill="#6d4a2f"/>`;
    out +=
      glassPanels(x + 90, y + 80, w * 0.34, h - 80, 2, id) +
      glassPanels(x + w * 0.55, y + 80, w * 0.34, h - 80, 2, id);
    out += `<rect x="${fmt(x)}" y="${fmt(y + 24)}" width="${fmt(w)}" height="30" fill="${accent}"/>`;
  } else {
    const w = 1500;
    const h = 330;
    const x = cx - w / 2;
    const y = groundY - h;
    out +=
      `<rect x="${fmt(x + w * 0.72)}" y="${fmt(groundY - 200)}" width="300" height="200" fill="${wall}"/><rect x="${fmt(x + w * 0.72)}" y="${fmt(groundY - 216)}" width="300" height="20" fill="${accent}"/>` +
      glassPanels(x + w * 0.72 + 30, groundY - 170, 120, 170, 2, id) +
      windowWithChajja(x + w * 0.72 + 180, groundY - 160, 90, 70, wall);
    for (let i = 0; i < 6; i += 1)
      out += `<rect x="${fmt(x + 20 + i * ((w * 0.68) / 5))}" y="${fmt(y)}" width="12" height="${fmt(h)}" fill="#6b7178"/>`;
    out += `<path d="M${fmt(x - 20)},${fmt(y + 30)} L${fmt(x + w * 0.7)},${fmt(y - 20)} L${fmt(x + w * 0.7)},${fmt(y + 20)} L${fmt(x - 20)},${fmt(y + 70)} Z" fill="${accent}"/><path d="M${fmt(x - 20)},${fmt(y + 70)} L${fmt(x + w * 0.7)},${fmt(y + 20)}" stroke="#000" stroke-width="6" opacity="0.2"/>`;
  }
  return out;
}

function bunting(y, rng, from, to) {
  const colors = ['#d23b3b', '#f0b429', '#2f80ed', '#27ae60', '#ffffff', '#9b51e0'];
  let out = `<path d="M${fmt(from)},${fmt(y)} Q${fmt((from + to) / 2)},${fmt(y + 40)} ${fmt(to)},${fmt(y)}" stroke="#555" stroke-width="2" fill="none"/>`;
  const n = Math.floor((to - from) / 34);
  for (let i = 0; i < n; i += 1) {
    const t = (i + 0.5) / n;
    const x = from + (to - from) * t;
    const yy = y + 40 * 4 * t * (1 - t) * 0.5 + 2;
    out += `<path d="M${fmt(x - 12)},${fmt(yy)} L${fmt(x + 12)},${fmt(yy)} L${fmt(x)},${fmt(yy + 30)} Z" fill="${colors[(i + rng.int(0, 5)) % colors.length]}"/>`;
  }
  return out;
}

export function yardScene({ key, state = 'Tamil Nadu', style: forcedStyle, sky: forcedSky }) {
  const rng = rngFor(`yard:${key}`);
  const id = uid('yd');
  const W = YARD_W;
  const H = YARD_H;
  const sky = SKIES[forcedSky ?? rng.pick(['morning', 'midday', 'midday', 'golden'])];
  const styles =
    state === 'Kerala'
      ? ['kerala', 'kerala', 'glass', 'concrete', 'canopy']
      : ['glass', 'concrete', 'canopy', 'premium', 'urban', 'concrete'];
  const style = forcedStyle ?? rng.pick(styles);
  const accent = rng.pick(ACCENTS);
  const wall = rng.pick(WALLS);
  const groundY = H * 0.66;

  const defs = [
    linear(`${id}sky`, [
      [0, sky.top],
      [1, sky.bottom],
    ]),
    linear(
      `${id}glass`,
      [
        [0, '#9fb6c6'],
        [0.5, '#5f7788'],
        [1, '#2b3a45'],
      ],
      { x1: 0, y1: 0, x2: 0.3, y2: 1 },
    ),
    linear(`${id}ground`, [
      [0, '#cfc9bf'],
      [1, '#b3ada3'],
    ]),
    linear(`${id}road`, [
      [0, '#4a4d52'],
      [1, '#2e3034'],
    ]),
    radial(
      `${id}vig`,
      [
        [0.6, '#000', 0],
        [1, '#000', 0.3],
      ],
      { r: 0.8 },
    ),
    linear(
      `${id}warm`,
      [
        [0, sky.light, 0.25],
        [1, sky.light, 0],
      ],
      { x1: 0, y1: 0, x2: 1, y2: 1 },
    ),
    blur(`${id}far`, 3),
    blur(`${id}cloud`, 28),
    blur(`${id}shadow`, 10),
  ].join('');

  let back = `<rect width="${W}" height="${H}" fill="url(#${id}sky)"/>`;
  back += `<g filter="url(#${id}cloud)" opacity="0.8">${Array.from({ length: 5 }, () => `<ellipse cx="${fmt(rng.between(0, W))}" cy="${fmt(rng.between(60, 260))}" rx="${fmt(rng.between(120, 260))}" ry="${fmt(rng.between(26, 50))}" fill="#fff"/>`).join('')}</g>`;
  back += `<g filter="url(#${id}far)" opacity="0.85">${skyline(groundY - 120, rng, sky.haze)}</g>`;
  let trees = '';
  for (let i = 0; i < 9; i += 1) {
    const x = rng.between(0, W);
    trees += rng.chance(0.6)
      ? palm(
          x,
          groundY - 60,
          rng.between(260, 380),
          rng.between(-50, 50),
          rng,
          rng.pick(['#2f6b3a', '#3b7a3f', '#2a5e36']),
        )
      : roundTree(
          x,
          groundY - 40,
          rng.between(220, 320),
          rng,
          rng.pick(['#3f7a45', '#4b8a4c', '#356b3c']),
        );
  }
  back += `<g opacity="0.95">${trees}</g>`;

  const main = building(style, W * rng.between(0.46, 0.54), groundY, rng, accent, wall, id);
  let compound = `<rect x="0" y="${fmt(groundY - 70)}" width="${W}" height="70" fill="${mix(wall, '#9a9a9a', 0.25)}"/><rect x="0" y="${fmt(groundY - 76)}" width="${W}" height="10" fill="${mix(wall, '#000000', 0.2)}"/>`;
  for (let x = 60; x < W; x += 280)
    compound += `<rect x="${fmt(x)}" y="${fmt(groundY - 96)}" width="26" height="96" fill="${mix(wall, '#000000', 0.12)}"/>`;

  const ground =
    `<rect x="0" y="${fmt(groundY)}" width="${W}" height="${fmt(H - groundY)}" fill="url(#${id}ground)"/>` +
    Array.from(
      { length: 18 },
      (_, i) =>
        `<path d="M${fmt(i * 140 - 60)},${fmt(groundY)} L${fmt(i * 170 - 360)},${fmt(H)}" stroke="#a9a397" stroke-width="2" opacity="0.5"/>`,
    ).join('') +
    Array.from(
      { length: 6 },
      (_, i) =>
        `<path d="M0,${fmt(groundY + 30 + i * i * 12)} L${W},${fmt(groundY + 30 + i * i * 12)}" stroke="#a9a397" stroke-width="2" opacity="0.4"/>`,
    ).join('');

  const road =
    `<rect x="0" y="${fmt(H * 0.915)}" width="${W}" height="${fmt(H * 0.085)}" fill="url(#${id}road)"/>` +
    Array.from(
      { length: 30 },
      (_, i) =>
        `<rect x="${fmt(i * 90)}" y="${fmt(H * 0.9)}" width="90" height="20" fill="${i % 2 ? '#f2c230' : '#1d1e20'}"/>`,
    ).join('');

  let cars = '';
  let carDefs = '';
  const rowY = H * 0.875;
  const nFront = rng.int(5, 7);
  const spacing = W / (nFront + 0.6);
  for (let i = 0; i < nFront; i += 1) {
    const paint = paintFor(rng.pick(CAR_COLORS), rng.next);
    const body = rng.pick(BODIES);
    const f = carFront({
      body,
      paint,
      view: 'front',
      grilleStyle: rng.pick(['slats', 'mesh', 'chrome', 'wide']),
      lampStyle: rng.pick(['slim', 'big']),
      scale: 0.29,
      plateMask: false,
    });
    const x = spacing * (i + 0.8) + rng.between(-20, 20);
    carDefs += f.defs;
    cars += `<ellipse cx="${fmt(x)}" cy="${fmt(rowY)}" rx="${fmt(f.width * 0.55)}" ry="12" fill="#000" opacity="0.35" filter="url(#${id}shadow)"/><g transform="translate(${fmt(x)} ${fmt(rowY)})">${f.body}</g>`;
  }
  let sideCars = '';
  const nSide = rng.int(1, 3);
  for (let i = 0; i < nSide; i += 1) {
    const paint = paintFor(rng.pick(CAR_COLORS), rng.next);
    const s = carSide({
      body: rng.pick(BODIES),
      paint,
      wheelStyle: rng.pick(['five', 'ten', 'multi']),
      scale: 0.3,
    });
    const x = rng.between(80, W - 80 - s.length);
    const y = groundY + 36;
    carDefs += s.defs;
    sideCars += `<ellipse cx="${fmt(x + s.length / 2)}" cy="${fmt(y)}" rx="${fmt(s.length * 0.52)}" ry="8" fill="#000" opacity="0.3" filter="url(#${id}shadow)"/><g transform="translate(${fmt(x)} ${fmt(y)})${rng.chance(0.5) ? ` translate(${fmt(s.length)} 0) scale(-1 1)` : ''}">${s.body}</g>`;
  }

  let props = '';
  for (const x of [W * 0.02, W * 0.98]) {
    props +=
      `<path d="M${fmt(x - 34)},${fmt(H * 0.9)} L${fmt(x - 26)},${fmt(H * 0.85)} L${fmt(x + 26)},${fmt(H * 0.85)} L${fmt(x + 34)},${fmt(H * 0.9)} Z" fill="#b5652f"/>` +
      roundTree(x, H * 0.855, 120, rng, '#3f8a45');
  }
  const flags =
    style !== 'premium' && rng.chance(0.7) ? bunting(groundY - 250, rng, W * 0.05, W * 0.95) : '';

  const body = [
    back,
    main,
    compound,
    flags,
    ground,
    sideCars,
    cars,
    road,
    props,
    `<rect width="${W}" height="${H}" fill="url(#${id}warm)"/>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}vig)"/>`,
  ].join('');
  return { svg: svgDoc(W, H, defs + carDefs, body), style, accent };
}
