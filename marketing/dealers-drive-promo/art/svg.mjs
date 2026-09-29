export function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function catmullRom(points, tension = 0.5, closed = false) {
  if (points.length < 2) return '';
  const pts = closed
    ? [points.at(-1), ...points, points[0], points[1]]
    : [points[0], ...points, points.at(-1)];
  let d = `M${fmt(pts[1][0])},${fmt(pts[1][1])}`;
  for (let i = 1; i < pts.length - 2; i += 1) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    const t = tension / 3;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${fmt(c1[0])},${fmt(c1[1])} ${fmt(c2[0])},${fmt(c2[1])} ${fmt(p2[0])},${fmt(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

export function smoothSegment(points, tension = 0.5) {
  return catmullRom(points, tension).replace(/^M[^C]*/, '');
}

export function poly(points) {
  return `M${points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' L')} Z`;
}

let counter = 0;
export function uid(prefix = 'g') {
  counter += 1;
  return `${prefix}${counter}`;
}

export function svgDoc(width, height, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`;
}

export function mix(a, b, t) {
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  const out = [0, 2, 4].map((i) => {
    const va = Number.parseInt(pa.slice(i, i + 2), 16);
    const vb = Number.parseInt(pb.slice(i, i + 2), 16);
    return Math.round(va + (vb - va) * t)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${out.join('')}`;
}

export function linear(id, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1, units } = {}) {
  const u = units ? ` gradientUnits="${units}"` : '';
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${u}>${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</linearGradient>`;
}

export function radial(id, stops, { cx = 0.5, cy = 0.5, r = 0.5, fx, fy, units } = {}) {
  const u = units ? ` gradientUnits="${units}"` : '';
  const f = fx !== undefined ? ` fx="${fx}" fy="${fy}"` : '';
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${f}${u}>${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</radialGradient>`;
}

export function blur(id, sd) {
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
}
