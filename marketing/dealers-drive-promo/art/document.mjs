import { fmt, svgDoc } from './svg.mjs';

export const DOC_W = 1240;
export const DOC_H = 1754;

/**
 * A blank, obviously-placeholder page for the onboarding upload step. It
 * carries no words on purpose: a generated "certificate" with invented text
 * would look like a forged document, which is the last thing a verification
 * film should show.
 */
export function documentPage(kind) {
  const accent = { gst: '#0f6e5c', pan: '#1d3f73', address: '#7a1f2b' }[kind] ?? '#2b2f36';
  let lines = '';
  for (let i = 0; i < 18; i += 1) {
    const y = 520 + i * 52;
    const w = i % 5 === 4 ? 520 : 900 - (i % 3) * 90;
    lines += `<rect x="170" y="${fmt(y)}" width="${fmt(w)}" height="14" rx="7" fill="#d9dde1"/>`;
  }
  const body = `<rect width="${DOC_W}" height="${DOC_H}" fill="#fbfbf8"/><rect x="120" y="120" width="${DOC_W - 240}" height="${DOC_H - 240}" fill="none" stroke="${accent}" stroke-width="6" rx="12"/><circle cx="${DOC_W / 2}" cy="300" r="90" fill="none" stroke="${accent}" stroke-width="10"/><rect x="${DOC_W / 2 - 220}" y="420" width="440" height="22" rx="11" fill="${accent}" opacity="0.6"/>${lines}<rect x="760" y="1450" width="300" height="120" rx="10" fill="none" stroke="${accent}" stroke-width="5" opacity="0.6"/>`;
  return svgDoc(DOC_W, DOC_H, '', body);
}
