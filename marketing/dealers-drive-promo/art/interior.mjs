import { blur, catmullRom, fmt, linear, mix, radial, svgDoc, uid } from './svg.mjs';

const W = 2000;
const H = 1500;

function screenUi(x, y, w, h, accent, variant = 'map') {
  const id = uid('ui');
  let content = '';
  if (variant === 'map') {
    const roads = [
      [
        [0.05, 0.8],
        [0.3, 0.62],
        [0.55, 0.66],
        [0.95, 0.3],
      ],
      [
        [0.1, 0.1],
        [0.3, 0.4],
        [0.35, 0.95],
      ],
      [
        [0.55, 0.05],
        [0.62, 0.5],
        [0.8, 0.95],
      ],
      [
        [0.0, 0.35],
        [0.45, 0.3],
        [1.0, 0.45],
      ],
    ];
    content += `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="#e9ecef"/>`;
    content += `<rect x="${fmt(x + w * 0.62)}" y="${fmt(y + h * 0.58)}" width="${fmt(w * 0.3)}" height="${fmt(h * 0.34)}" rx="8" fill="#cfe5d3"/>`;
    content += `<rect x="${fmt(x + w * 0.08)}" y="${fmt(y + h * 0.1)}" width="${fmt(w * 0.16)}" height="${fmt(h * 0.2)}" rx="8" fill="#cfe0ef"/>`;
    for (const road of roads) {
      content += `<path d="${catmullRom(
        road.map(([a, b]) => [x + a * w, y + b * h]),
        0.5,
      )}" fill="none" stroke="#ffffff" stroke-width="${fmt(h * 0.06)}" stroke-linecap="round"/>`;
    }
    content += `<path d="${catmullRom(
      roads[0].map(([a, b]) => [x + a * w, y + b * h]),
      0.5,
    )}" fill="none" stroke="${accent}" stroke-width="${fmt(h * 0.03)}" stroke-linecap="round"/>`;
    content += `<circle cx="${fmt(x + w * 0.3)}" cy="${fmt(y + h * 0.62)}" r="${fmt(h * 0.045)}" fill="#fff" stroke="${accent}" stroke-width="${fmt(h * 0.018)}"/>`;
    content += `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w * 0.22)}" height="${fmt(h)}" fill="#1c2127" opacity="0.92"/>`;
    for (let i = 0; i < 4; i += 1) {
      content += `<rect x="${fmt(x + w * 0.05)}" y="${fmt(y + h * (0.14 + i * 0.2))}" width="${fmt(w * 0.12)}" height="${fmt(h * 0.1)}" rx="${fmt(h * 0.03)}" fill="${i === 0 ? accent : '#39414b'}"/>`;
    }
  } else {
    content += `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="url(#${id}bg)"/>`;
    content += `<rect x="${fmt(x + w * 0.08)}" y="${fmt(y + h * 0.18)}" width="${fmt(h * 0.64)}" height="${fmt(h * 0.64)}" rx="${fmt(h * 0.06)}" fill="${accent}"/>`;
    content += `<circle cx="${fmt(x + w * 0.08 + h * 0.32)}" cy="${fmt(y + h * 0.5)}" r="${fmt(h * 0.16)}" fill="#fff" opacity="0.35"/>`;
    for (let i = 0; i < 3; i += 1) {
      content += `<rect x="${fmt(x + w * 0.08 + h * 0.8)}" y="${fmt(y + h * (0.26 + i * 0.16))}" width="${fmt(w * (0.4 - i * 0.1))}" height="${fmt(h * 0.06)}" rx="${fmt(h * 0.03)}" fill="#ffffff" opacity="${fmt(0.75 - i * 0.2)}"/>`;
    }
    content += `<rect x="${fmt(x + w * 0.08 + h * 0.8)}" y="${fmt(y + h * 0.78)}" width="${fmt(w * 0.5)}" height="${fmt(h * 0.03)}" rx="${fmt(h * 0.015)}" fill="#ffffff" opacity="0.25"/><rect x="${fmt(x + w * 0.08 + h * 0.8)}" y="${fmt(y + h * 0.78)}" width="${fmt(w * 0.2)}" height="${fmt(h * 0.03)}" rx="${fmt(h * 0.015)}" fill="#fff"/>`;
  }
  const defs =
    linear(
      `${id}bg`,
      [
        [0, '#28313b'],
        [1, '#12161b'],
      ],
      { x1: 0, y1: 0, x2: 1, y2: 1 },
    ) +
    `<clipPath id="${id}c"><rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(h * 0.04)}"/></clipPath>`;
  return {
    defs,
    body: `<g clip-path="url(#${id}c)">${content}</g><rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(h * 0.04)}" fill="none" stroke="#050607" stroke-width="${fmt(h * 0.04)}"/>`,
  };
}

function steeringWheel(cx, cy, r, trim, accent) {
  const id = uid('sw');
  const defs =
    radial(`${id}r`, [
      [0.8, '#2a2c30'],
      [0.9, '#3b3e43'],
      [1, '#141517'],
    ]) +
    linear(`${id}hub`, [
      [0, '#35383d'],
      [1, '#18191c'],
    ]);
  const ring = `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="none" stroke="#0d0e10" stroke-width="${fmt(r * 0.19)}"/><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="none" stroke="#2b2d31" stroke-width="${fmt(r * 0.15)}"/><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r * 1.05)}" fill="none" stroke="#4a4e54" stroke-width="${fmt(r * 0.012)}"/><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="none" stroke="#3a3d42" stroke-width="${fmt(r * 0.04)}" stroke-dasharray="${fmt(r * 0.9)} ${fmt(r * 5.4)}" transform="rotate(200 ${fmt(cx)} ${fmt(cy)})"/>`;
  const spokes = [
    `M${fmt(cx - r * 0.95)},${fmt(cy + r * 0.05)} L${fmt(cx - r * 0.3)},${fmt(cy + r * 0.02)} L${fmt(cx - r * 0.28)},${fmt(cy + r * 0.28)} L${fmt(cx - r * 0.9)},${fmt(cy + r * 0.3)} Z`,
    `M${fmt(cx + r * 0.95)},${fmt(cy + r * 0.05)} L${fmt(cx + r * 0.3)},${fmt(cy + r * 0.02)} L${fmt(cx + r * 0.28)},${fmt(cy + r * 0.28)} L${fmt(cx + r * 0.9)},${fmt(cy + r * 0.3)} Z`,
    `M${fmt(cx - r * 0.18)},${fmt(cy + r * 0.35)} L${fmt(cx + r * 0.18)},${fmt(cy + r * 0.35)} L${fmt(cx + r * 0.12)},${fmt(cy + r * 0.95)} L${fmt(cx - r * 0.12)},${fmt(cy + r * 0.95)} Z`,
  ]
    .map((d) => `<path d="${d}" fill="url(#${id}hub)"/>`)
    .join('');
  const buttons = [-1, 1]
    .map((side) =>
      [0, 1, 2]
        .map(
          (i) =>
            `<circle cx="${fmt(cx + side * r * (0.5 + i * 0.12))}" cy="${fmt(cy + r * 0.15)}" r="${fmt(r * 0.045)}" fill="#50545a" stroke="#1a1b1d" stroke-width="2"/>`,
        )
        .join(''),
    )
    .join('');
  const hub = `<ellipse cx="${fmt(cx)}" cy="${fmt(cy + r * 0.1)}" rx="${fmt(r * 0.34)}" ry="${fmt(r * 0.3)}" fill="url(#${id}hub)" stroke="${accent}" stroke-width="${fmt(r * 0.012)}"/><rect x="${fmt(cx - r * 0.1)}" y="${fmt(cy + r * 0.05)}" width="${fmt(r * 0.2)}" height="${fmt(r * 0.1)}" rx="${fmt(r * 0.03)}" fill="#6b7076"/>`;
  return { defs, body: spokes + hub + buttons + ring };
}

function cluster(x, y, w, h, accent) {
  const id = uid('cl');
  const dial = (cx, cy, r, value) => {
    const a0 = Math.PI * 0.8;
    const a1 = Math.PI * 2.2;
    const av = a0 + (a1 - a0) * value;
    const pt = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    const [sx, sy] = pt(a0, r);
    const [ex, ey] = pt(a1, r);
    const [vx, vy] = pt(av, r);
    const ticks = Array.from({ length: 11 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / 10;
      const [x1, y1] = pt(a, r * 0.86);
      const [x2, y2] = pt(a, r * 0.96);
      return `<path d="M${fmt(x1)},${fmt(y1)} L${fmt(x2)},${fmt(y2)}" stroke="#9aa3ad" stroke-width="${fmt(r * 0.03)}"/>`;
    }).join('');
    const [nx, ny] = pt(av, r * 0.8);
    return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r * 1.08)}" fill="#07090b"/><path d="M${fmt(sx)},${fmt(sy)} A${fmt(r)},${fmt(r)} 0 1 1 ${fmt(ex)},${fmt(ey)}" fill="none" stroke="#2a3139" stroke-width="${fmt(r * 0.08)}"/><path d="M${fmt(sx)},${fmt(sy)} A${fmt(r)},${fmt(r)} 0 ${value > 0.5 ? 1 : 0} 1 ${fmt(vx)},${fmt(vy)}" fill="none" stroke="${accent}" stroke-width="${fmt(r * 0.08)}"/>${ticks}<path d="M${fmt(cx)},${fmt(cy)} L${fmt(nx)},${fmt(ny)}" stroke="#ff5d4d" stroke-width="${fmt(r * 0.05)}" stroke-linecap="round"/><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r * 0.1)}" fill="#1d2228"/>`;
  };
  const defs = linear(`${id}b`, [
    [0, '#101418'],
    [1, '#05070a'],
  ]);
  const body = `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(h * 0.2)}" fill="url(#${id}b)" stroke="#1e2126" stroke-width="4"/>${dial(x + w * 0.25, y + h * 0.52, h * 0.36, 0.35)}${dial(x + w * 0.75, y + h * 0.52, h * 0.36, 0.55)}<rect x="${fmt(x + w * 0.42)}" y="${fmt(y + h * 0.3)}" width="${fmt(w * 0.16)}" height="${fmt(h * 0.42)}" rx="${fmt(h * 0.05)}" fill="#141a20"/><rect x="${fmt(x + w * 0.445)}" y="${fmt(y + h * 0.36)}" width="${fmt(w * 0.11)}" height="${fmt(h * 0.05)}" rx="3" fill="${accent}" opacity="0.8"/><rect x="${fmt(x + w * 0.445)}" y="${fmt(y + h * 0.48)}" width="${fmt(w * 0.08)}" height="${fmt(h * 0.04)}" rx="3" fill="#8a949e" opacity="0.7"/><rect x="${fmt(x + w * 0.445)}" y="${fmt(y + h * 0.58)}" width="${fmt(w * 0.1)}" height="${fmt(h * 0.04)}" rx="3" fill="#8a949e" opacity="0.5"/>`;
  return { defs, body };
}

function vent(x, y, w, h, trim) {
  let slats = '';
  for (let i = 1; i < 5; i += 1) {
    slats += `<rect x="${fmt(x + w * 0.06)}" y="${fmt(y + (h * i) / 5 - h * 0.035)}" width="${fmt(w * 0.88)}" height="${fmt(h * 0.07)}" rx="2" fill="#2b2e33"/>`;
  }
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(h * 0.18)}" fill="#0c0d0f" stroke="${trim}" stroke-width="4"/>${slats}`;
}

function windowLight(id, x, y, w, h) {
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="url(#${id}sky)"/><g filter="url(#${id}soft)" opacity="0.7"><rect x="${fmt(x + w * 0.05)}" y="${fmt(y + h * 0.55)}" width="${fmt(w * 0.3)}" height="${fmt(h * 0.5)}" fill="#c4ccd2"/><rect x="${fmt(x + w * 0.4)}" y="${fmt(y + h * 0.45)}" width="${fmt(w * 0.22)}" height="${fmt(h * 0.6)}" fill="#b5bec5"/><rect x="${fmt(x + w * 0.7)}" y="${fmt(y + h * 0.6)}" width="${fmt(w * 0.3)}" height="${fmt(h * 0.5)}" fill="#cad2d8"/></g>`;
}

export function dashboardShot({ interior, accent = '#2f7df6' }) {
  const id = uid('db');
  const sw = steeringWheel(W * 0.7, H * 0.66, H * 0.26, interior.trim, interior.accent);
  const cl = cluster(W * 0.58, H * 0.4, W * 0.24, H * 0.16, accent);
  const scr = screenUi(W * 0.33, H * 0.33, W * 0.24, H * 0.17, accent, 'map');
  const defs = [
    linear(`${id}sky`, [
      [0, '#f4f7f9'],
      [1, '#dde3e8'],
    ]),
    blur(`${id}soft`, 18),
    linear(`${id}dash`, [
      [0, mix(interior.dash, '#ffffff', 0.12)],
      [0.3, interior.dash],
      [1, mix(interior.dash, '#000000', 0.5)],
    ]),
    linear(`${id}seat`, [
      [0, interior.seatLight],
      [1, interior.seatDark],
    ]),
    radial(
      `${id}vig`,
      [
        [0.6, '#000', 0],
        [1, '#000', 0.45],
      ],
      { r: 0.75 },
    ),
    sw.defs,
    cl.defs,
    scr.defs,
  ].join('');
  const body = [
    windowLight(id, 0, 0, W, H * 0.5),
    `<path d="M0,0 L${fmt(W * 0.12)},0 L${fmt(W * 0.02)},${fmt(H * 0.55)} L0,${fmt(H * 0.55)} Z" fill="#0f1012"/>`,
    `<path d="M${fmt(W)},0 L${fmt(W * 0.88)},0 L${fmt(W * 0.98)},${fmt(H * 0.55)} L${fmt(W)},${fmt(H * 0.55)} Z" fill="#0f1012"/>`,
    `<rect x="0" y="0" width="${W}" height="${fmt(H * 0.06)}" fill="#1a1b1e"/>`,
    `<rect x="${fmt(W * 0.44)}" y="${fmt(H * 0.05)}" width="${fmt(W * 0.12)}" height="${fmt(H * 0.05)}" rx="${fmt(H * 0.02)}" fill="#141517"/>`,
    `<path d="M0,${fmt(H * 0.48)} C${fmt(W * 0.3)},${fmt(H * 0.4)} ${fmt(W * 0.7)},${fmt(H * 0.4)} ${fmt(W)},${fmt(H * 0.48)} L${fmt(W)},${fmt(H)} L0,${fmt(H)} Z" fill="url(#${id}dash)"/>`,
    `<path d="M0,${fmt(H * 0.6)} C${fmt(W * 0.3)},${fmt(H * 0.54)} ${fmt(W * 0.7)},${fmt(H * 0.54)} ${fmt(W)},${fmt(H * 0.6)}" stroke="${interior.accent}" stroke-width="${fmt(H * 0.008)}" fill="none" opacity="0.8"/>`,
    vent(W * 0.36, H * 0.54, W * 0.08, H * 0.06, interior.accent),
    vent(W * 0.46, H * 0.54, W * 0.08, H * 0.06, interior.accent),
    vent(W * 0.08, H * 0.52, W * 0.1, H * 0.07, interior.accent),
    `<rect x="${fmt(W * 0.37)}" y="${fmt(H * 0.64)}" width="${fmt(W * 0.16)}" height="${fmt(H * 0.07)}" rx="${fmt(H * 0.02)}" fill="#141517"/>`,
    [0, 1, 2]
      .map(
        (i) =>
          `<circle cx="${fmt(W * (0.4 + i * 0.05))}" cy="${fmt(H * 0.675)}" r="${fmt(H * 0.018)}" fill="#3b3f45" stroke="${interior.accent}" stroke-width="3"/>`,
      )
      .join(''),
    `<path d="M${fmt(W * 0.38)},${fmt(H)} L${fmt(W * 0.41)},${fmt(H * 0.76)} L${fmt(W * 0.5)},${fmt(H * 0.76)} L${fmt(W * 0.53)},${fmt(H)} Z" fill="#161719"/>`,
    `<ellipse cx="${fmt(W * 0.455)}" cy="${fmt(H * 0.84)}" rx="${fmt(W * 0.022)}" ry="${fmt(H * 0.05)}" fill="#2c2f34" stroke="${interior.accent}" stroke-width="3"/>`,
    scr.body,
    cl.body,
    sw.body,
    `<path d="M${fmt(-W * 0.05)},${fmt(H)} C${fmt(W * 0.02)},${fmt(H * 0.8)} ${fmt(W * 0.2)},${fmt(H * 0.78)} ${fmt(W * 0.3)},${fmt(H * 0.86)} L${fmt(W * 0.33)},${fmt(H)} Z" fill="url(#${id}seat)"/>`,
    `<path d="M${fmt(W * 1.05)},${fmt(H)} C${fmt(W * 1.0)},${fmt(H * 0.86)} ${fmt(W * 0.9)},${fmt(H * 0.9)} ${fmt(W * 0.84)},${fmt(H * 0.95)} L${fmt(W * 0.82)},${fmt(H)} Z" fill="url(#${id}seat)"/>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}vig)"/>`,
  ].join('');
  return svgDoc(W, H, defs, body);
}

export function steeringShot({ interior, accent = '#2f7df6' }) {
  const id = uid('ss');
  const sw = steeringWheel(W * 0.5, H * 0.72, H * 0.52, interior.trim, interior.accent);
  const cl = cluster(W * 0.27, H * 0.2, W * 0.46, H * 0.3, accent);
  const defs = [
    linear(`${id}dash`, [
      [0, mix(interior.dash, '#ffffff', 0.1)],
      [1, mix(interior.dash, '#000000', 0.55)],
    ]),
    radial(
      `${id}vig`,
      [
        [0.55, '#000', 0],
        [1, '#000', 0.55],
      ],
      { r: 0.75 },
    ),
    linear(`${id}sky`, [
      [0, '#eef2f5'],
      [1, '#d7dde2'],
    ]),
    sw.defs,
    cl.defs,
  ].join('');
  const body = [
    `<rect width="${W}" height="${fmt(H * 0.18)}" fill="url(#${id}sky)"/>`,
    `<path d="M0,${fmt(H * 0.14)} C${fmt(W * 0.3)},${fmt(H * 0.08)} ${fmt(W * 0.7)},${fmt(H * 0.08)} ${fmt(W)},${fmt(H * 0.14)} L${fmt(W)},${fmt(H)} L0,${fmt(H)} Z" fill="url(#${id}dash)"/>`,
    `<path d="M${fmt(W * 0.22)},${fmt(H * 0.55)} C${fmt(W * 0.22)},${fmt(H * 0.12)} ${fmt(W * 0.78)},${fmt(H * 0.12)} ${fmt(W * 0.78)},${fmt(H * 0.55)}" fill="#141518"/>`,
    cl.body,
    vent(W * 0.03, H * 0.34, W * 0.14, H * 0.1, interior.accent),
    vent(W * 0.83, H * 0.34, W * 0.14, H * 0.1, interior.accent),
    sw.body,
    `<rect width="${W}" height="${H}" fill="url(#${id}vig)"/>`,
  ].join('');
  return svgDoc(W, H, defs, body);
}

export function infotainmentShot({ interior, accent = '#2f7df6', variant = 'map' }) {
  const id = uid('is');
  const scr = screenUi(W * 0.16, H * 0.14, W * 0.68, H * 0.48, accent, variant);
  const defs = [
    linear(`${id}dash`, [
      [0, mix(interior.dash, '#ffffff', 0.1)],
      [1, mix(interior.dash, '#000000', 0.55)],
    ]),
    radial(
      `${id}vig`,
      [
        [0.55, '#000', 0],
        [1, '#000', 0.5],
      ],
      { r: 0.75 },
    ),
    blur(`${id}glow`, 30),
    scr.defs,
  ].join('');
  const body = [
    `<rect width="${W}" height="${H}" fill="url(#${id}dash)"/>`,
    `<rect x="${fmt(W * 0.16)}" y="${fmt(H * 0.14)}" width="${fmt(W * 0.68)}" height="${fmt(H * 0.48)}" fill="${accent}" opacity="0.25" filter="url(#${id}glow)"/>`,
    scr.body,
    vent(W * 0.24, H * 0.7, W * 0.22, H * 0.1, interior.accent),
    vent(W * 0.54, H * 0.7, W * 0.22, H * 0.1, interior.accent),
    `<rect x="${fmt(W * 0.3)}" y="${fmt(H * 0.86)}" width="${fmt(W * 0.4)}" height="${fmt(H * 0.08)}" rx="${fmt(H * 0.02)}" fill="#111214"/>`,
    [0, 1, 2, 3, 4]
      .map(
        (i) =>
          `<rect x="${fmt(W * (0.33 + i * 0.07))}" y="${fmt(H * 0.885)}" width="${fmt(W * 0.05)}" height="${fmt(H * 0.03)}" rx="6" fill="#3a3e44"/>`,
      )
      .join(''),
    `<rect width="${W}" height="${H}" fill="url(#${id}vig)"/>`,
  ].join('');
  return svgDoc(W, H, defs, body);
}

function seatBack(x, y, w, h, interior, id) {
  const back = `M${fmt(x + w * 0.08)},${fmt(y + h)} C${fmt(x)},${fmt(y + h * 0.5)} ${fmt(x + w * 0.02)},${fmt(y + h * 0.12)} ${fmt(x + w * 0.12)},${fmt(y + h * 0.05)} L${fmt(x + w * 0.88)},${fmt(y + h * 0.05)} C${fmt(x + w * 0.98)},${fmt(y + h * 0.12)} ${fmt(x + w)},${fmt(y + h * 0.5)} ${fmt(x + w * 0.92)},${fmt(y + h)} Z`;
  const insert = `M${fmt(x + w * 0.25)},${fmt(y + h * 0.95)} L${fmt(x + w * 0.22)},${fmt(y + h * 0.18)} L${fmt(x + w * 0.78)},${fmt(y + h * 0.18)} L${fmt(x + w * 0.75)},${fmt(y + h * 0.95)} Z`;
  let quilting = '';
  for (let i = 1; i < 6; i += 1) {
    const yy = y + h * (0.18 + i * 0.13);
    quilting += `<path d="M${fmt(x + w * 0.235)},${fmt(yy)} L${fmt(x + w * 0.765)},${fmt(yy)}" stroke="${interior.stitch}" stroke-width="3" stroke-dasharray="10 7" opacity="0.8"/>`;
  }
  const head = `<rect x="${fmt(x + w * 0.22)}" y="${fmt(y - h * 0.32)}" width="${fmt(w * 0.56)}" height="${fmt(h * 0.3)}" rx="${fmt(h * 0.1)}" fill="url(#${id}seat)"/><rect x="${fmt(x + w * 0.36)}" y="${fmt(y - h * 0.04)}" width="${fmt(w * 0.03)}" height="${fmt(h * 0.1)}" fill="#8c9197"/><rect x="${fmt(x + w * 0.61)}" y="${fmt(y - h * 0.04)}" width="${fmt(w * 0.03)}" height="${fmt(h * 0.1)}" fill="#8c9197"/>`;
  return `${head}<path d="${back}" fill="url(#${id}seat)"/><path d="${insert}" fill="${interior.seatDark}" opacity="0.35"/><path d="${insert}" fill="none" stroke="${interior.stitch}" stroke-width="3" stroke-dasharray="10 7"/>${quilting}`;
}

export function rearSeatsShot({ interior }) {
  const id = uid('rs');
  const defs = [
    linear(`${id}seat`, [
      [0, interior.seatLight],
      [0.6, interior.seat],
      [1, interior.seatDark],
    ]),
    linear(`${id}cab`, [
      [0, '#2a2c30'],
      [1, '#141517'],
    ]),
    linear(`${id}sky`, [
      [0, '#f1f4f6'],
      [1, '#d9dfe4'],
    ]),
    blur(`${id}soft`, 14),
    radial(
      `${id}vig`,
      [
        [0.55, '#000', 0],
        [1, '#000', 0.5],
      ],
      { r: 0.75 },
    ),
  ].join('');
  const body = [
    `<rect width="${W}" height="${H}" fill="url(#${id}cab)"/>`,
    `<path d="M${fmt(W * 0.1)},${fmt(H * 0.08)} L${fmt(W * 0.9)},${fmt(H * 0.08)} L${fmt(W * 0.85)},${fmt(H * 0.34)} L${fmt(W * 0.15)},${fmt(H * 0.34)} Z" fill="url(#${id}sky)"/>`,
    `<g filter="url(#${id}soft)" opacity="0.6"><rect x="${fmt(W * 0.2)}" y="${fmt(H * 0.2)}" width="${fmt(W * 0.2)}" height="${fmt(H * 0.14)}" fill="#b9c2c9"/><rect x="${fmt(W * 0.55)}" y="${fmt(H * 0.17)}" width="${fmt(W * 0.25)}" height="${fmt(H * 0.17)}" fill="#c6ced4"/></g>`,
    `<rect x="${fmt(W * 0.1)}" y="${fmt(H * 0.34)}" width="${fmt(W * 0.8)}" height="${fmt(H * 0.06)}" fill="#101113"/>`,
    seatBack(W * 0.1, H * 0.46, W * 0.28, H * 0.42, interior, id),
    seatBack(W * 0.36, H * 0.48, W * 0.28, H * 0.4, interior, id),
    seatBack(W * 0.62, H * 0.46, W * 0.28, H * 0.42, interior, id),
    `<path d="M${fmt(W * 0.02)},${fmt(H * 0.86)} C${fmt(W * 0.3)},${fmt(H * 0.8)} ${fmt(W * 0.7)},${fmt(H * 0.8)} ${fmt(W * 0.98)},${fmt(H * 0.86)} L${fmt(W)},${fmt(H)} L0,${fmt(H)} Z" fill="url(#${id}seat)"/>`,
    `<path d="M${fmt(W * 0.05)},${fmt(H * 0.9)} C${fmt(W * 0.3)},${fmt(H * 0.85)} ${fmt(W * 0.7)},${fmt(H * 0.85)} ${fmt(W * 0.95)},${fmt(H * 0.9)}" fill="none" stroke="${interior.stitch}" stroke-width="3" stroke-dasharray="10 7"/>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}vig)"/>`,
  ].join('');
  return svgDoc(W, H, defs, body);
}

export function frontSeatsShot({ interior }) {
  const id = uid('fs');
  const defs = [
    linear(`${id}seat`, [
      [0, interior.seatLight],
      [0.6, interior.seat],
      [1, interior.seatDark],
    ]),
    linear(`${id}cab`, [
      [0, '#1f2124'],
      [1, '#0e0f10'],
    ]),
    linear(`${id}sky`, [
      [0, '#f3f6f8'],
      [1, '#d6dde2'],
    ]),
    radial(
      `${id}vig`,
      [
        [0.55, '#000', 0],
        [1, '#000', 0.5],
      ],
      { r: 0.75 },
    ),
  ].join('');
  const body = [
    `<rect width="${W}" height="${H}" fill="url(#${id}cab)"/>`,
    `<path d="M0,${fmt(H * 0.05)} L${fmt(W)},${fmt(H * 0.05)} L${fmt(W)},${fmt(H * 0.32)} C${fmt(W * 0.6)},${fmt(H * 0.28)} ${fmt(W * 0.4)},${fmt(H * 0.28)} 0,${fmt(H * 0.32)} Z" fill="url(#${id}sky)"/>`,
    `<path d="M0,${fmt(H * 0.32)} C${fmt(W * 0.4)},${fmt(H * 0.28)} ${fmt(W * 0.6)},${fmt(H * 0.28)} ${fmt(W)},${fmt(H * 0.32)} L${fmt(W)},${fmt(H * 0.52)} L0,${fmt(H * 0.52)} Z" fill="${interior.dash}"/>`,
    seatBack(W * 0.1, H * 0.4, W * 0.34, H * 0.55, interior, id),
    seatBack(W * 0.56, H * 0.4, W * 0.34, H * 0.55, interior, id),
    `<path d="M${fmt(W * 0.44)},${fmt(H)} L${fmt(W * 0.46)},${fmt(H * 0.66)} L${fmt(W * 0.54)},${fmt(H * 0.66)} L${fmt(W * 0.56)},${fmt(H)} Z" fill="#141517"/>`,
    `<rect x="${fmt(W * 0.462)}" y="${fmt(H * 0.66)}" width="${fmt(W * 0.076)}" height="${fmt(H * 0.03)}" rx="8" fill="${interior.accent}" opacity="0.6"/>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}vig)"/>`,
  ].join('');
  return svgDoc(W, H, defs, body);
}

export function bootShot({ paint, interior, body: bodyType = 'SUV' }) {
  const id = uid('bt');
  const open = { l: W * 0.24, r: W * 0.76, t: H * 0.28, b: H * 0.74 };
  const defs = [
    linear(`${id}b`, [
      [0, paint.light],
      [0.4, paint.base],
      [1, paint.dark],
    ]),
    linear(`${id}carpet`, [
      [0, '#2c2e32'],
      [1, '#18191c'],
    ]),
    linear(`${id}wall`, [
      [0, '#e8ebee'],
      [1, '#f6f7f8'],
    ]),
    linear(`${id}floor`, [
      [0, '#dfe3e7'],
      [1, '#c3c9cf'],
    ]),
    linear(`${id}seat`, [
      [0, interior.seatLight],
      [1, interior.seatDark],
    ]),
    radial(
      `${id}vig`,
      [
        [0.6, '#000', 0],
        [1, '#000', 0.25],
      ],
      { r: 0.75 },
    ),
    blur(`${id}sh`, 20),
  ].join('');
  const markup = [
    `<rect width="${W}" height="${fmt(H * 0.72)}" fill="url(#${id}wall)"/>`,
    `<rect y="${fmt(H * 0.72)}" width="${W}" height="${fmt(H * 0.28)}" fill="url(#${id}floor)"/>`,
    `<ellipse cx="${fmt(W / 2)}" cy="${fmt(H * 0.93)}" rx="${fmt(W * 0.36)}" ry="${fmt(H * 0.03)}" fill="#000" opacity="0.45" filter="url(#${id}sh)"/>`,
    `<path d="M${fmt(W * 0.16)},${fmt(H * 0.92)} L${fmt(W * 0.16)},${fmt(H * 0.3)} C${fmt(W * 0.16)},${fmt(H * 0.22)} ${fmt(W * 0.2)},${fmt(H * 0.2)} ${fmt(W * 0.26)},${fmt(H * 0.2)} L${fmt(W * 0.74)},${fmt(H * 0.2)} C${fmt(W * 0.8)},${fmt(H * 0.2)} ${fmt(W * 0.84)},${fmt(H * 0.22)} ${fmt(W * 0.84)},${fmt(H * 0.3)} L${fmt(W * 0.84)},${fmt(H * 0.92)} Z" fill="url(#${id}b)"/>`,
    `<rect x="${fmt(open.l)}" y="${fmt(open.t)}" width="${fmt(open.r - open.l)}" height="${fmt(open.b - open.t)}" rx="${fmt(H * 0.02)}" fill="#111214"/>`,
    `<path d="M${fmt(open.l + 20)},${fmt(open.t + H * 0.02)} L${fmt(open.r - 20)},${fmt(open.t + H * 0.02)} L${fmt(open.r - W * 0.05)},${fmt(open.t + H * 0.24)} L${fmt(open.l + W * 0.05)},${fmt(open.t + H * 0.24)} Z" fill="url(#${id}seat)"/>`,
    `<path d="M${fmt(open.l + W * 0.05)},${fmt(open.t + H * 0.24)} L${fmt(open.r - W * 0.05)},${fmt(open.t + H * 0.24)} L${fmt(open.r - 12)},${fmt(open.b - 12)} L${fmt(open.l + 12)},${fmt(open.b - 12)} Z" fill="url(#${id}carpet)"/>`,
    `<path d="M${fmt(W / 2)},${fmt(open.t + H * 0.02)} L${fmt(W / 2)},${fmt(open.t + H * 0.24)}" stroke="${interior.stitch}" stroke-width="4" opacity="0.6"/>`,
    `<rect x="${fmt(open.l + W * 0.1)}" y="${fmt(open.b - H * 0.07)}" width="${fmt(W * 0.32)}" height="${fmt(H * 0.02)}" rx="6" fill="#3b3e43"/>`,
    `<rect x="${fmt(W * 0.14)}" y="${fmt(H * 0.74)}" width="${fmt(W * 0.72)}" height="${fmt(H * 0.13)}" rx="${fmt(H * 0.03)}" fill="url(#${id}b)"/>`,
    `<rect x="${fmt(W * 0.14)}" y="${fmt(H * 0.84)}" width="${fmt(W * 0.72)}" height="${fmt(H * 0.05)}" rx="${fmt(H * 0.02)}" fill="#1b1c1e"/>`,
    `<path d="M${fmt(W * 0.2)},${fmt(H * 0.04)} L${fmt(W * 0.8)},${fmt(H * 0.04)} L${fmt(W * 0.84)},${fmt(H * 0.19)} L${fmt(W * 0.16)},${fmt(H * 0.19)} Z" fill="#26282b"/>`,
    `<path d="M${fmt(W * 0.22)},${fmt(H * 0.05)} L${fmt(W * 0.78)},${fmt(H * 0.05)} L${fmt(W * 0.8)},${fmt(H * 0.1)} L${fmt(W * 0.2)},${fmt(H * 0.1)} Z" fill="#101113"/>`,
    `<rect x="${fmt(W * 0.13)}" y="${fmt(H * 0.28)}" width="${fmt(W * 0.05)}" height="${fmt(H * 0.12)}" rx="8" fill="#b3121b"/>`,
    `<rect x="${fmt(W * 0.82)}" y="${fmt(H * 0.28)}" width="${fmt(W * 0.05)}" height="${fmt(H * 0.12)}" rx="8" fill="#b3121b"/>`,
    `<rect width="${W}" height="${H}" fill="url(#${id}vig)"/>`,
  ].join('');
  return svgDoc(W, H, defs, markup);
}
