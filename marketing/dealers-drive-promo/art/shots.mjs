import { carFront } from './car-front.mjs';
import { carSide } from './car-side.mjs';
import { groundShadow, reflection, studio } from './studio.mjs';
import { blur, fmt, svgDoc, uid } from './svg.mjs';
import { YARD_H, YARD_W, yardScene } from './yard.mjs';

export const PHOTO_W = 2000;
export const PHOTO_H = 1500;

function withViewBox(svg, [x, y, w, h]) {
  return svg.replace(/viewBox="[^"]*"/, `viewBox="${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}"`);
}

function crop(cx, cy, zoom) {
  const w = PHOTO_W / zoom;
  const h = PHOTO_H / zoom;
  return [cx - w / 2, cy - h / 2, w, h];
}

export function sideShot({ car, facing = 'left', theme = 'studioLight' }) {
  const W = PHOTO_W;
  const H = PHOTO_H;
  const st = studio({ width: W, height: H, theme });
  const side = carSide({
    body: car.body,
    paint: car.paint,
    wheelStyle: car.wheelStyle,
    wheelTone: car.wheelTone,
  });
  const groundY = H * 0.74;
  const x0 = (W - side.length) / 2;
  const flipped = facing === 'right';
  const flip = flipped ? `translate(${fmt(side.length)} 0) scale(-1 1)` : '';
  const carMarkup = `<g transform="translate(${fmt(x0)} ${fmt(groundY)})"><g transform="${flip}">${side.body}</g></g>`;
  const shadow = groundShadow({
    cx: W / 2,
    cy: groundY,
    rx: side.length * 0.52,
    ry: side.wheelR * 0.35,
    opacity: st.shadowOpacity,
  });
  const refl = reflection({
    markup: carMarkup,
    groundY,
    opacity: st.reflectOpacity,
    height: H - groundY,
  });
  const toCanvas = (localX) => x0 + (flipped ? side.length - localX : localX);
  return {
    svg: svgDoc(
      W,
      H,
      st.defs + side.defs + shadow.defs + refl.defs,
      st.back + refl.body + shadow.body + carMarkup + st.front,
    ),
    frontWheel: [toCanvas(side.front), groundY - side.wheelR],
    rearWheel: [toCanvas(side.rear), groundY - side.wheelR],
    wheelR: side.wheelR,
  };
}

export function faceShot({ car, view = 'front', theme = 'studioLight' }) {
  const W = PHOTO_W;
  const H = PHOTO_H;
  const st = studio({ width: W, height: H, theme });
  const face = carFront({
    body: car.body,
    paint: car.paint,
    view,
    grilleStyle: car.grilleStyle,
    lampStyle: car.lampStyle,
  });
  const groundY = H * 0.78;
  const carMarkup = `<g transform="translate(${fmt(W / 2)} ${fmt(groundY)})">${face.body}</g>`;
  const shadow = groundShadow({
    cx: W / 2,
    cy: groundY,
    rx: face.width * 0.56,
    ry: face.height * 0.03,
    opacity: st.shadowOpacity,
  });
  const refl = reflection({
    markup: carMarkup,
    groundY,
    opacity: st.reflectOpacity,
    height: H - groundY,
  });
  return {
    svg: svgDoc(
      W,
      H,
      st.defs + face.defs + shadow.defs + refl.defs,
      st.back + refl.body + shadow.body + carMarkup + st.front,
    ),
    lamp: [W / 2 - face.width * 0.34, groundY - face.height * (face.belt ?? 0.52)],
    width: face.width,
    height: face.height,
    groundY,
  };
}

export function wheelDetail(side, which = 'front') {
  const [cx, cy] = which === 'front' ? side.frontWheel : side.rearWheel;
  return withViewBox(side.svg, crop(cx, cy - side.wheelR * 0.15, 3.2));
}

export function lampDetail(face) {
  const [cx, cy] = face.lamp;
  return withViewBox(face.svg, crop(cx - face.width * 0.04, cy + face.height * 0.03, 2.6));
}

export function yardContextShot({ car, dealerKey, state, facing = 'left' }) {
  const W = PHOTO_W;
  const H = PHOTO_H;
  const id = uid('yc');
  const yard = yardScene({ key: dealerKey, state });
  const scale = H / YARD_H;
  const yardW = YARD_W * scale;
  const inner = yard.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const side = carSide({
    body: car.body,
    paint: car.paint,
    wheelStyle: car.wheelStyle,
    wheelTone: car.wheelTone,
    scale: 1.12,
  });
  const groundY = H * 0.93;
  const x0 = (W - side.length) / 2;
  const flip = facing === 'right' ? `translate(${fmt(side.length)} 0) scale(-1 1)` : '';
  const shadow = groundShadow({
    cx: W / 2,
    cy: groundY,
    rx: side.length * 0.52,
    ry: side.wheelR * 0.35,
    opacity: 0.6,
  });
  const defs = blur(`${id}b`, 7) + shadow.defs + side.defs;
  const body = `<g filter="url(#${id}b)"><g transform="translate(${fmt((W - yardW) / 2)} 0) scale(${fmt(scale)})">${inner}</g></g><rect width="${W}" height="${H}" fill="#000" opacity="0.06"/>${shadow.body}<g transform="translate(${fmt(x0)} ${fmt(groundY)})"><g transform="${flip}">${side.body}</g></g>`;
  return svgDoc(W, H, defs, body);
}
