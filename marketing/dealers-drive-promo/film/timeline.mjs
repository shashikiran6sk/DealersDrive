import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * The film, as data. Every clip is either real footage of the app — stills
 * captured by `scripts/capture.mjs` and moved with a camera, a cursor and a
 * lower third — or a title card. `film/stage/stage.js` draws one frame of
 * this at a time; `scripts/render-film.mjs` asks it for every frame.
 *
 * Times inside a clip are seconds from the clip's own start. Coordinates are
 * CSS pixels of the capture viewport (1440×810 on desktop), so a target the
 * capture recorded can be used as a cursor position unchanged.
 */

export const NARRATION = {
  opening: 'Buying a used car often starts with endless searching.',
  discover: 'Dealers-Drive brings local dealership inventory together in one simple marketplace.',
  search: 'Choose your district, then narrow it down — body type, transmission, price.',
  vehicle:
    "Every car comes with a full photo gallery, clear specifications and the dealer's own price.",
  dealer:
    'And behind every car is a verified dealership you can explore — its yard, its details, its whole inventory.',
  enquiry:
    'Found the one? Sign in with your mobile number and your enquiry goes straight to the dealer.',
  transition: 'For dealerships, Dealers-Drive becomes their digital showroom.',
  onboarding:
    'Sign up with a verified mobile number, add your business details and documents, and submit for verification.',
  profile: 'Once approved, your dealership has a professional page of its own.',
  inventory:
    'Add vehicles, and keep every listing accurate — reserved, sold or withdrawn, in a click.',
  enquiries:
    'And when a buyer like Arjun enquires, it lands in your inbox with his verified number, ready for a call.',
  montage: 'Dealers-Drive connects car buyers with the dealerships that serve them.',
  close: 'Discover. Connect. Drive.',
};

export const CLOSING_URL = 'dealers-drive.com';

const FEATURED_YARD = 'dealers/green-circle-motors-llp-vellore-tamil-nadu/yard.jpg';
const APPLICANT_YARD = 'dealers/metro-motors-vellore/yard.jpg';

function srtTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(r, 3)}`;
}

export async function buildTimeline({ format = 'landscape', captions = true, root, device }) {
  if (format === 'portrait') return buildPortrait({ captions, root });
  return buildLandscape({ format, captions, root, device: device ?? 'desktop' });
}

function loadCapture(root, device) {
  const recDir = join(root, 'recordings', device);
  const capturePath = join(recDir, 'capture.json');
  if (!existsSync(capturePath))
    throw new Error(`No capture at ${capturePath} — run npm run capture first.`);
  const cap = JSON.parse(readFileSync(capturePath, 'utf8'));
  const fileUrl = (rel) => pathToFileURL(join(recDir, rel)).href;
  const shotOf = (scene, name) => {
    const entry = cap.scenes[scene]?.shots[name];
    if (!entry) throw new Error(`Missing ${device} capture ${scene}/${name} — re-run the capture.`);
    return entry;
  };
  const S = (scene, name, from = 0, extra = {}) => {
    const entry = shotOf(scene, name);
    if (entry.tiles) {
      return {
        from,
        tiles: entry.tiles.map((tile) => ({ src: fileUrl(tile.file), y: tile.y })),
        pageHeight: entry.pageHeight,
        pinned: entry.pinned
          ? { src: fileUrl(entry.pinned.file), height: entry.pinned.height }
          : null,
        ...extra,
      };
    }
    return { from, src: fileUrl(entry.file), ...extra };
  };
  const T = (scene, name) => {
    const target = cap.scenes[scene]?.targets[name];
    if (!target) throw new Error(`Missing ${device} target ${scene}/${name} — re-run the capture.`);
    return { x: target.x, y: target.y };
  };
  return { cap, S, T, viewport: cap.viewport };
}

function sequencer(viewport) {
  const clips = [];
  const narration = [];
  let cursorTime = 0;
  return {
    clips,
    narration,
    now: () => cursorTime,
    add(clip, vo) {
      const fadeIn = clip.fadeIn ?? 0.5;
      const start = clips.length === 0 ? 0 : cursorTime - fadeIn;
      clips.push({ viewport, ...clip, fadeIn: clips.length === 0 ? 0 : fadeIn, start });
      cursorTime = start + clip.dur;
      if (vo) narration.push({ text: vo.text, from: start + vo.from, to: start + vo.to });
    },
    finish() {
      const srt = narration
        .map(
          (line, i) =>
            `${String(i + 1)}\n${srtTime(line.from)} --> ${srtTime(line.to)}\n${line.text}\n`,
        )
        .join('\n');
      return { clips, duration: cursorTime, srt, narration };
    },
  };
}

async function buildPortrait({ captions, root }) {
  const { S, T, viewport } = loadCapture(root, 'mobile');
  const assetUrl = (rel) => pathToFileURL(join(root, 'assets', 'generated', rel)).href;
  const seq = sequencer(viewport);
  const W = viewport.width;
  const H = viewport.height;
  const at = (t, p, extra = {}) => ({ t, x: p.x, y: p.y, ...extra });
  const tap = (t, p) => [at(t - 0.15, p), at(t, p, { click: true }), at(t + 0.2, p)];
  const cam = (t, y, z = 1, x = W / 2) => ({ t, x, y, z });
  const lower = (kicker, text, from, to) =>
    captions ? [{ kicker, text, from, to }] : [{ kicker, text: '', from, to }];
  const off = { x: W / 2, y: H + 200 };

  seq.add(
    {
      kind: 'title',
      dur: 5.2,
      photo: assetUrl(FEATURED_YARD),
      zoomFrom: 1.08,
      zoomTo: 1.0,
      shade:
        'linear-gradient(0deg, rgba(8,9,10,0.9) 0%, rgba(8,9,10,0.55) 60%, rgba(8,9,10,0.35) 100%)',
      align: 'left',
      brand: { size: 44, delay: 0.2 },
      headline: 'Find your next car.<br/>From dealers you can discover and trust.',
      headlineSize: 80,
      lower: captions ? [{ kicker: '', text: NARRATION.opening, from: 2.0, to: 5.0 }] : [],
    },
    { text: NARRATION.opening, from: 2.0, to: 5.0 },
  );

  seq.add(
    {
      kind: 'ui',
      dur: 6.4,
      shots: [
        S('discover', 'cars-page', 0, {
          scroll: [
            { t: 0, y: 0 },
            { t: 1.2, y: 0 },
            { t: 5.6, y: 1150 },
          ],
        }),
      ],
      camera: [cam(0, 346), cam(6.4, 346)],
      lower: lower('Find your next car', NARRATION.discover, 0.5, 6.2),
    },
    { text: NARRATION.discover, from: 0.5, to: 6.2 },
  );

  const filters = T('search', 'filters');
  const suv = T('search', 'suv');
  const automatic = T('search', 'automatic');
  const show = T('search', 'show');
  seq.add(
    {
      kind: 'ui',
      dur: 9.4,
      shots: [
        S('discover', 'cars', 0),
        S('search', 'sheet', 1.1, { fade: 0.3 }),
        S('search', 'sheet-body', 2.2, { fade: 0.4 }),
        S('search', 'suv', 3.3, { fade: 0.2 }),
        S('search', 'sheet-transmission', 4.3, { fade: 0.4 }),
        S('search', 'automatic', 5.4, { fade: 0.2 }),
        S('search', 'results', 6.7, { fade: 0.35 }),
      ],
      camera: [
        cam(0, 346),
        cam(1.0, 346),
        cam(1.6, 420),
        cam(6.6, 440),
        cam(7.0, 346),
        cam(9.4, 346),
      ],
      cursor: [
        at(0.2, off, { hide: true }),
        at(0.5, { x: filters.x + 40, y: filters.y + 60 }),
        ...tap(0.9, filters),
        at(1.5, { x: 250, y: 600 }),
        ...tap(3.1, suv),
        ...tap(5.2, automatic),
        ...tap(6.5, show),
        at(7.0, show, { hide: true }),
        at(9.4, show, { hide: true }),
      ],
      lower: lower('Search the way you shop', NARRATION.search, 0.4, 9.2),
    },
    { text: NARRATION.search, from: 0.4, to: 9.2 },
  );

  const viewAll = T('vehicle', 'viewAll');
  const next = T('vehicle', 'next');
  seq.add(
    {
      kind: 'ui',
      dur: 9.6,
      shots: [
        S('vehicle', 'vdp', 0),
        S('vehicle', 'photo-1', 1.2, { fade: 0.3 }),
        S('vehicle', 'photo-2', 2.4, { fade: 0.25 }),
        S('vehicle', 'photo-5', 3.5, { fade: 0.25 }),
        S('vehicle', 'photo-14', 4.6, { fade: 0.25 }),
        S('vehicle', 'vdp-page', 6.2, {
          fade: 0.4,
          scroll: [
            { t: 0, y: 0 },
            { t: 0.5, y: 0 },
            { t: 3.0, y: 700 },
          ],
        }),
      ],
      camera: [
        cam(0, 346),
        cam(1.1, 346),
        cam(1.3, 422, 1.35),
        cam(6.0, 422, 1.35),
        cam(6.3, 346),
        cam(9.6, 346),
      ],
      cursor: [
        at(0.2, off, { hide: true }),
        at(0.5, { x: viewAll.x + 60, y: viewAll.y + 80 }),
        ...tap(0.95, viewAll),
        ...tap(2.3, next),
        ...tap(3.4, next),
        ...tap(4.5, next),
        at(5.0, next, { hide: true }),
        at(9.6, next, { hide: true }),
      ],
      lower: lower('Explore every detail', NARRATION.vehicle, 0.4, 9.4),
    },
    { text: NARRATION.vehicle, from: 0.4, to: 9.4 },
  );

  seq.add(
    {
      kind: 'ui',
      dur: 7.0,
      shots: [
        S('dealer', 'portfolio-page', 0, {
          scroll: [
            { t: 0, y: 0 },
            { t: 3.0, y: 0 },
          ],
        }),
        S('dealer', 'directory-page', 3.4, {
          fade: 0.45,
          scroll: [
            { t: 0, y: 0 },
            { t: 0.6, y: 0 },
            { t: 3.4, y: 700 },
          ],
        }),
      ],
      camera: [cam(0, 346), cam(7.0, 346)],
      lower: lower('Discover local dealerships', NARRATION.dealer, 0.3, 6.8),
    },
    { text: NARRATION.dealer, from: 0.3, to: 6.8 },
  );

  const enquire = T('enquiry', 'enquire');
  const phone = T('enquiry', 'phone');
  const verify = T('enquiry', 'verify');
  const send = T('enquiry', 'send');
  seq.add(
    {
      kind: 'ui',
      dur: 9.4,
      shots: [
        S('enquiry', 'vdp', 0),
        S('enquiry', 'login', 1.2, { fade: 0.35 }),
        S('enquiry', 'otp-filled', 2.5, { fade: 0.3 }),
        S('enquiry', 'form', 3.8, { fade: 0.35 }),
        S('enquiry', 'typed', 5.0, { fade: 0.35 }),
        S('enquiry', 'sent', 6.4, { fade: 0.3 }),
      ],
      camera: [
        cam(0, 500),
        cam(1.1, 500),
        cam(1.3, 346),
        cam(3.7, 380),
        cam(3.9, 346),
        cam(9.4, 346),
      ],
      cursor: [
        at(0.2, off, { hide: true }),
        at(0.5, { x: enquire.x + 60, y: enquire.y - 80 }),
        ...tap(0.95, enquire),
        at(1.6, phone, { hide: true }),
        at(3.0, verify, { hide: true }),
        ...tap(3.4, verify),
        at(3.7, verify, { hide: true }),
        at(5.8, send, { hide: true }),
        ...tap(6.2, send),
        at(6.6, send, { hide: true }),
        at(9.4, send, { hide: true }),
      ],
      lower: lower('Connect directly', NARRATION.enquiry, 0.3, 9.2),
    },
    { text: NARRATION.enquiry, from: 0.3, to: 9.2 },
  );

  seq.add(
    {
      kind: 'title',
      dur: 4.0,
      fadeIn: 0.6,
      photo: assetUrl(APPLICANT_YARD),
      zoomFrom: 1.25,
      zoomTo: 1.4,
      shade:
        'linear-gradient(0deg, rgba(8,9,10,0.9) 0%, rgba(8,9,10,0.6) 60%, rgba(8,9,10,0.4) 100%)',
      align: 'left',
      eyebrow: 'For dealerships',
      headline: 'Dealers-Drive becomes your digital showroom.',
      headlineSize: 76,
    },
    { text: NARRATION.transition, from: 0.4, to: 3.8 },
  );

  seq.add(
    {
      kind: 'ui',
      dur: 5.2,
      shots: [S('onboarding', 'login-otp', 0), S('onboarding', 'account', 2.0, { fade: 0.4 })],
      camera: [cam(0, 346), cam(5.2, 346)],
      lower: lower('Get your dealership online', NARRATION.onboarding, 0.3, 5.0),
    },
    { text: NARRATION.onboarding, from: 0.3, to: 5.0 },
  );

  seq.add(
    {
      kind: 'ui',
      dur: 10.4,
      shots: [
        S('console', 'dashboard', 0),
        S('console', 'inventory', 2.4, { fade: 0.4 }),
        S('console', 'enquiries', 6.6, { fade: 0.45 }),
      ],
      camera: [cam(0, 346), cam(2.4, 346), cam(6.4, 470), cam(6.6, 346), cam(10.4, 346)],
      lower: [
        ...lower('Manage inventory', NARRATION.inventory, 0.3, 6.4),
        ...lower('Manage enquiries', NARRATION.enquiries, 6.7, 10.2),
      ],
    },
    { text: NARRATION.inventory, from: 0.3, to: 6.4 },
  );
  seq.narration.push({ text: NARRATION.enquiries, from: seq.now() - 3.7, to: seq.now() - 0.2 });

  seq.add(
    {
      kind: 'title',
      dur: 5.6,
      fadeIn: 0.6,
      backdrop: 'dark',
      brand: { size: 64, delay: 0.2 },
      headline: 'A better digital marketplace for used cars.',
      headlineSize: 70,
      sub: `Discover. Connect. Drive.<br/><span style="opacity:.6;font-size:.8em">${CLOSING_URL}</span>`,
    },
    { text: NARRATION.close, from: 1.0, to: 5.4 },
  );
  return seq.finish();
}

async function buildLandscape({ format = 'landscape', captions = true, root, device = 'desktop' }) {
  const recDir = join(root, 'recordings', device);
  const capturePath = join(recDir, 'capture.json');
  if (!existsSync(capturePath))
    throw new Error(`No capture at ${capturePath} — run npm run capture first.`);
  const cap = JSON.parse(readFileSync(capturePath, 'utf8'));
  const viewport = cap.viewport;
  const fileUrl = (rel) => pathToFileURL(join(recDir, rel)).href;
  const assetUrl = (rel) => pathToFileURL(join(root, 'assets', 'generated', rel)).href;

  const shotOf = (scene, name) => {
    const entry = cap.scenes[scene]?.shots[name];
    if (!entry) throw new Error(`Missing capture ${scene}/${name} — re-run the capture.`);
    return entry;
  };
  const S = (scene, name, from = 0, extra = {}) => {
    const entry = shotOf(scene, name);
    if (entry.tiles) {
      return {
        from,
        tiles: entry.tiles.map((tile) => ({ src: fileUrl(tile.file), y: tile.y })),
        pageHeight: entry.pageHeight,
        pinned: entry.pinned
          ? { src: fileUrl(entry.pinned.file), height: entry.pinned.height }
          : null,
        ...extra,
      };
    }
    return { from, src: fileUrl(entry.file), ...extra };
  };
  const T = (scene, name) => {
    const target = cap.scenes[scene]?.targets[name];
    if (!target) throw new Error(`Missing target ${scene}/${name} — re-run the capture.`);
    return { x: target.x, y: target.y };
  };
  const at = (t, p, extra = {}) => ({ t, x: p.x, y: p.y, ...extra });
  const click = (t, p) => [at(t - 0.12, p), at(t, p, { click: true }), at(t + 0.18, p)];
  const cam = (t, x, y, z = 1) => ({ t, x, y, z });
  const W = viewport.width;
  const H = viewport.height;
  const C = (t, z = 1) => cam(t, W / 2, H / 2, z);
  const lower = (kicker, text, from, to) =>
    captions ? [{ kicker, text, from, to }] : kicker ? [{ kicker, text: '', from, to }] : [];

  const clips = [];
  const narration = [];
  let cursorTime = 0;
  const add = (clip, vo) => {
    const fadeIn = clip.fadeIn ?? 0.5;
    const start = clips.length === 0 ? 0 : cursorTime - fadeIn;
    clips.push({ viewport, ...clip, fadeIn: clips.length === 0 ? 0 : fadeIn, start });
    cursorTime = start + clip.dur;
    if (vo) narration.push({ text: vo.text, from: start + vo.from, to: start + vo.to });
  };

  // 1 — opening
  add(
    {
      kind: 'title',
      dur: 6.5,
      photo: assetUrl(FEATURED_YARD),
      zoomFrom: 1.14,
      zoomTo: 1.02,
      align: 'left',
      brand: { size: 40, delay: 0.2 },
      headline: 'Find your next car.<br/>From dealers you can<br/>discover and trust.',
      headlineSize: format === 'portrait' ? 78 : 92,
      lower: captions ? [{ kicker: '', text: NARRATION.opening, from: 2.4, to: 6.3 }] : [],
    },
    { text: NARRATION.opening, from: 2.4, to: 6.3 },
  );

  // 2 — discover
  add(
    {
      kind: 'ui',
      dur: 8.4,
      shots: [
        S('discover', 'home-page', 0, {
          scroll: [
            { t: 0, y: 0 },
            { t: 1.2, y: 0 },
            { t: 3.8, y: 640 },
          ],
        }),
        S('discover', 'cars-page', 4.4, {
          fade: 0.45,
          scroll: [
            { t: 0, y: 0 },
            { t: 1.0, y: 0 },
            { t: 3.6, y: 300 },
          ],
        }),
      ],
      camera: [C(0, 1.04), C(4.2, 1.0), C(8.4, 1.06)],
      lower: lower('Find your next car', NARRATION.discover, 0.6, 8.2),
      squareFocusX: 820,
      squareCamera: [
        cam(0, 560, 405),
        cam(4.2, 560, 405),
        cam(4.5, 760, 405),
        cam(8.4, 760, 405, 1.03),
      ],
    },
    { text: NARRATION.discover, from: 0.6, to: 8.2 },
  );

  // 3 — search and filters
  const district = T('search', 'district');
  const vellore = T('search', 'vellore');
  const suv = T('search', 'suv');
  const automatic = T('search', 'automatic');
  add(
    {
      kind: 'ui',
      dur: 11.2,
      shots: [
        S('search', 'start', 0),
        S('search', 'district-dialog', 1.5, { fade: 0.25 }),
        S('search', 'vellore', 3.1, { fade: 0.3 }),
        S('search', 'rail-scrolled', 4.4, { fade: 0.45 }),
        S('search', 'suv', 5.9, { fade: 0.25 }),
        S('search', 'automatic', 7.4, { fade: 0.25 }),
      ],
      camera: [
        C(0),
        C(4.2),
        cam(5.2, 560, 420, 1.12),
        cam(7.9, 560, 420, 1.12),
        cam(9.4, 880, 510, 1.35),
        cam(11.2, 880, 512, 1.37),
      ],
      cursor: [
        at(0.3, { x: 1000, y: 620 }),
        at(1.2, district),
        ...click(1.35, district),
        at(2.6, vellore),
        ...click(2.95, vellore),
        at(4.0, { x: 520, y: 420 }),
        at(5.3, suv),
        ...click(5.75, suv),
        at(6.8, automatic),
        ...click(7.25, automatic),
        at(8.6, { x: 610, y: 470 }),
        at(11.2, { x: 620, y: 470 }),
      ],
      lower: lower('Search the way you shop', NARRATION.search, 0.4, 11.0),
      squareFocusX: 560,
      squareCamera: [
        cam(0, 560, 405),
        cam(1.3, 560, 405),
        cam(1.5, 675, 405),
        cam(3.0, 675, 405),
        cam(3.3, 480, 405),
        cam(7.9, 480, 405),
        cam(9.4, 690, 480, 1.2),
        cam(11.2, 690, 480, 1.22),
      ],
    },
    { text: NARRATION.search, from: 0.4, to: 11.0 },
  );

  // 4 — vehicle portfolio
  const thumb0 = T('vehicle', 'thumb0');
  const thumb1 = T('vehicle', 'thumb1');
  const thumb2 = T('vehicle', 'thumb2');
  const thumb3 = T('vehicle', 'thumb3');
  const viewDealership = T('vehicle', 'viewDealership');
  add(
    {
      kind: 'ui',
      dur: 12.6,
      shots: [
        S('vehicle', 'vdp', 0),
        S('vehicle', 'photo-2', 2.0, { fade: 0.3 }),
        S('vehicle', 'photo-8', 3.7, { fade: 0.25 }),
        S('vehicle', 'photo-5', 5.2, { fade: 0.25 }),
        S('vehicle', 'photo-14', 6.7, { fade: 0.25 }),
        S('vehicle', 'vdp-page', 8.6, {
          fade: 0.4,
          scroll: [
            { t: 0, y: 0 },
            { t: 0.6, y: 0 },
            { t: 2.6, y: 560 },
            { t: 3.4, y: 560 },
          ],
        }),
      ],
      camera: [cam(0, 520, 380, 1.08), cam(1.8, 520, 380, 1.08), C(2.2), C(8.4), C(12.6, 1.03)],
      cursor: [
        at(0.3, { x: 760, y: 420 }),
        at(1.6, thumb0),
        ...click(1.85, thumb0),
        at(3.3, thumb1),
        ...click(3.55, thumb1),
        at(4.8, thumb2),
        ...click(5.05, thumb2),
        at(6.3, thumb3),
        ...click(6.55, thumb3),
        at(8.3, { x: 1200, y: 420 }),
        at(8.5, { x: 1200, y: 420, hide: true }),
        at(12.6, { x: 1200, y: 420, hide: true }),
      ],
      lower: lower('Explore every detail', NARRATION.vehicle, 0.4, 12.4),
      squareFocusX: 560,
      squareCamera: [
        cam(0, 450, 405),
        cam(1.9, 450, 405),
        cam(2.2, 720, 405),
        cam(8.4, 720, 405),
        cam(8.7, 450, 405),
        cam(12.6, 450, 405, 1.03),
      ],
    },
    { text: NARRATION.vehicle, from: 0.4, to: 12.4 },
  );

  // 5 — dealer discovery
  add(
    {
      kind: 'ui',
      dur: 10.4,
      shots: [
        S('vehicle', 'vdp-closed', 0),
        S('dealer', 'portfolio', 1.3, { fade: 0.35 }),
        S('dealer', 'portfolio-page', 4.0, {
          fade: 0.5,
          scroll: [
            { t: 0, y: 1040 },
            { t: 0.6, y: 1040 },
            { t: 3.0, y: 1180 },
          ],
        }),
        S('dealer', 'directory-page', 7.2, {
          fade: 0.45,
          scroll: [
            { t: 0, y: 0 },
            { t: 0.8, y: 0 },
            { t: 3.0, y: 250 },
          ],
        }),
      ],
      camera: [C(0), C(1.3), cam(3.8, W / 2, 380, 1.08), C(4.2), C(7.2), C(10.4, 1.04)],
      cursor: [
        at(0.0, { x: 1150, y: 560 }),
        at(0.8, viewDealership),
        ...click(1.05, viewDealership),
        at(1.3, viewDealership, { hide: true }),
        at(10.4, viewDealership, { hide: true }),
      ],
      lower: lower('Discover local dealerships', NARRATION.dealer, 0.3, 10.2),
      squareFocusX: 700,
      squareCamera: [
        cam(0, 1050, 405),
        cam(1.2, 1050, 405),
        cam(1.5, 560, 405),
        cam(10.4, 560, 405, 1.03),
      ],
    },
    { text: NARRATION.dealer, from: 0.3, to: 10.2 },
  );

  // 6 — customer enquiry
  const enquire = T('enquiry', 'enquire');
  const phone = T('enquiry', 'phone');
  const verify = T('enquiry', 'verify');
  const message = T('enquiry', 'message');
  const send = T('enquiry', 'send');
  const typing = ['typing-02', 'typing-05', 'typing-08', 'typing-11', 'typing-13'];
  add(
    {
      kind: 'ui',
      dur: 11.0,
      shots: [
        S('enquiry', 'vdp', 0),
        S('enquiry', 'login', 1.4, { fade: 0.35 }),
        S('enquiry', 'otp', 2.6, { fade: 0.3 }),
        S('enquiry', 'otp-filled', 3.4, { fade: 0.2 }),
        S('enquiry', 'form', 4.6, { fade: 0.35 }),
        ...typing.map((name, i) => S('enquiry', name, 5.4 + i * 0.36, { fade: 0.08 })),
        S('enquiry', 'sent', 8.1, { fade: 0.3 }),
      ],
      camera: [
        C(0),
        cam(1.2, 1080, 440, 1.0),
        cam(1.4, 1110, 400, 1.65),
        cam(4.3, 1110, 400, 1.65),
        cam(4.7, 1080, 560, 1.3),
        cam(10.0, 1080, 520, 1.3),
        cam(11, 1080, 520, 1.32),
      ],
      cursor: [
        at(0.2, { x: 900, y: 600 }),
        at(0.95, enquire),
        ...click(1.15, enquire),
        at(1.5, phone),
        at(2.3, phone),
        at(3.0, { x: phone.x, y: phone.y + 60 }),
        at(3.8, verify),
        ...click(4.2, verify),
        at(4.8, message),
        ...click(5.1, message),
        at(7.4, send),
        ...click(7.8, send),
        at(8.4, { x: send.x + 120, y: send.y - 160 }),
        at(11, { x: send.x + 130, y: send.y - 170 }),
      ],
      lower: lower('Connect directly', NARRATION.enquiry, 0.4, 10.8),
      squareFocusX: 1000,
      squareCamera: [
        cam(0, 640, 405),
        cam(1.2, 640, 405),
        cam(1.4, 1080, 405, 1.2),
        cam(4.3, 1080, 405, 1.2),
        cam(4.7, 660, 560, 1.15),
        cam(11, 660, 540, 1.17),
      ],
    },
    { text: NARRATION.enquiry, from: 0.4, to: 10.8 },
  );

  // 7 — transition
  add(
    {
      kind: 'title',
      dur: 4.6,
      fadeIn: 0.7,
      photo: assetUrl(APPLICANT_YARD),
      zoomFrom: 1.02,
      zoomTo: 1.12,
      shade:
        'linear-gradient(90deg, rgba(8,9,10,0.86) 0%, rgba(8,9,10,0.62) 55%, rgba(8,9,10,0.35) 100%)',
      align: 'left',
      eyebrow: 'For dealerships',
      headline: 'Dealers-Drive becomes<br/>your digital showroom.',
      headlineSize: format === 'portrait' ? 76 : 86,
    },
    { text: NARRATION.transition, from: 0.5, to: 4.4 },
  );

  // 8 — dealer onboarding
  const formX = 720;
  const saveIds = T('onboarding', 'saveIds');
  const submit = T('onboarding', 'submit');
  add(
    {
      kind: 'ui',
      dur: 11.6,
      shots: [
        S('onboarding', 'login', 0),
        S('onboarding', 'account', 1.5, { fade: 0.35 }),
        S('onboarding', 'business-filled', 3.6, { fade: 0.35 }),
        S('onboarding', 'registrations-saved', 5.8, { fade: 0.35 }),
        S('onboarding', 'documents-uploaded', 7.0, { fade: 0.35 }),
        S('onboarding', 'after-documents', 8.6, { fade: 0.3 }),
        S('onboarding', 'submitted', 9.8, { fade: 0.35 }),
      ],
      camera: [
        cam(0, 1080, 420, 1.3),
        cam(1.3, 1080, 420, 1.3),
        cam(1.6, formX, 300, 1.75),
        cam(3.4, formX, 300, 1.75),
        cam(3.7, formX, 380, 1.55),
        cam(5.6, formX, 380, 1.55),
        cam(5.9, formX, 320, 1.6),
        cam(8.4, formX, 360, 1.6),
        cam(8.7, formX, 260, 1.8),
        cam(11.6, formX, 240, 1.85),
      ],
      cursor: [
        at(0.2, { x: 1100, y: 560 }),
        at(1.3, { x: 1110, y: 570, hide: true }),
        at(5.4, { x: saveIds.x + 80, y: saveIds.y + 60, hide: true }),
        at(5.8, { x: saveIds.x + 80, y: saveIds.y + 60 }),
        at(6.5, { x: 820, y: 520 }),
        at(8.8, submit),
        ...click(9.5, submit),
        at(10.2, { x: submit.x + 140, y: submit.y + 90 }),
        at(11.6, { x: submit.x + 150, y: submit.y + 95 }),
      ],
      lower: lower('Get your dealership online', NARRATION.onboarding, 0.3, 11.4),
      squareFocusX: formX,
      squareCamera: [
        cam(0, 1080, 420, 1.1),
        cam(1.3, 1080, 420, 1.1),
        cam(1.6, formX, 300, 1.4),
        cam(3.4, formX, 300, 1.4),
        cam(3.7, formX, 380, 1.25),
        cam(5.6, formX, 380, 1.25),
        cam(5.9, formX, 320, 1.3),
        cam(8.4, formX, 360, 1.3),
        cam(8.7, formX, 260, 1.45),
        cam(11.6, formX, 240, 1.5),
      ],
    },
    { text: NARRATION.onboarding, from: 0.3, to: 11.4 },
  );

  // 9 — dealership profile and public page
  const navProfile = T('console', 'navProfile');
  add(
    {
      kind: 'ui',
      dur: 9.2,
      shots: [
        S('console', 'dashboard', 0),
        S('console', 'profile', 2.3, { fade: 0.35 }),
        S('dealer', 'portfolio', 5.2, { fade: 0.5 }),
      ],
      camera: [
        C(0),
        C(2.1),
        cam(2.4, 520, 250, 1.5),
        cam(5.0, 520, 240, 1.52),
        C(5.4),
        C(9.2, 1.06),
      ],
      cursor: [
        at(0.3, { x: 700, y: 400 }),
        at(1.6, navProfile),
        ...click(1.95, navProfile),
        at(2.4, navProfile, { hide: true }),
        at(9.2, navProfile, { hide: true }),
      ],
      lower: lower('Your digital storefront', NARRATION.profile, 0.3, 9.0),
      squareFocusX: 700,
      squareCamera: [
        cam(0, 520, 405),
        cam(2.1, 520, 405),
        cam(2.4, 520, 300, 1.2),
        cam(5.0, 520, 300, 1.22),
        cam(5.4, 720, 405),
        cam(9.2, 720, 405, 1.04),
      ],
    },
    { text: NARRATION.profile, from: 0.3, to: 9.0 },
  );

  // 10 — inventory management
  const reserve = T('console', 'reserve');
  const confirm = T('console', 'confirmReserve');
  const addVehicle = { x: 112, y: 191 };
  add(
    {
      kind: 'ui',
      dur: 13.2,
      shots: [
        S('console', 'inventory', 0),
        S('console', 'reserve-dialog', 3.6, { fade: 0.25 }),
        S('console', 'reserved', 5.3, { fade: 0.3 }),
        S('console', 'add-vehicle', 9.6, { fade: 0.35 }),
      ],
      camera: [
        C(0),
        cam(1.6, 832, 470, 1.2),
        cam(3.2, 832, 480, 1.2),
        C(3.6),
        C(5.2),
        cam(6.2, 832, 480, 1.2),
        cam(8.6, 832, 480, 1.2),
        C(9.4),
        cam(10.4, 760, 330, 1.45),
        cam(13.2, 760, 330, 1.5),
      ],
      cursor: [
        at(0.4, { x: 900, y: 380 }),
        at(3.0, reserve),
        ...click(3.4, reserve),
        at(4.6, confirm),
        ...click(5.05, confirm),
        at(6.2, { x: 1000, y: 620 }),
        at(8.4, addVehicle),
        ...click(9.3, addVehicle),
        at(10.0, { x: 520, y: 330 }),
        at(13.2, { x: 540, y: 340 }),
      ],
      lower: lower('Manage inventory', NARRATION.inventory, 0.3, 13.0),
      squareFocusX: 820,
      squareCamera: [
        cam(0, 560, 405),
        cam(2.2, 560, 405),
        cam(2.9, 950, 480, 1.1),
        cam(3.6, 800, 405),
        cam(5.2, 800, 405),
        cam(6.2, 700, 480, 1.1),
        cam(8.2, 700, 480, 1.1),
        cam(9.4, 520, 405),
        cam(10.4, 620, 330, 1.2),
        cam(13.2, 620, 330, 1.22),
      ],
    },
    { text: NARRATION.inventory, from: 0.3, to: 13.0 },
  );

  // 11 — enquiry management
  const markContacted = T('console', 'markContacted');
  add(
    {
      kind: 'ui',
      dur: 9.6,
      shots: [
        S('console', 'enquiries', 0),
        S('console', 'contacted', 4.6, { fade: 0.3 }),
        S('console', 'dashboard-after', 7.2, { fade: 0.45 }),
      ],
      camera: [
        C(0),
        cam(1.4, 832, 330, 1.25),
        cam(4.4, 832, 340, 1.25),
        cam(6.8, 832, 340, 1.25),
        C(7.2),
        C(9.6, 1.05),
      ],
      cursor: [
        at(0.4, { x: 700, y: 500 }),
        at(3.6, markContacted),
        ...click(4.35, markContacted),
        at(5.4, { x: markContacted.x - 150, y: markContacted.y + 120 }),
        at(7.0, { x: markContacted.x - 150, y: markContacted.y + 120, hide: true }),
        at(9.6, { x: markContacted.x - 150, y: markContacted.y + 120, hide: true }),
      ],
      lower: lower('Turn interest into conversations', NARRATION.enquiries, 0.3, 9.4),
      squareFocusX: 860,
      squareCamera: [
        cam(0, 580, 405),
        cam(1.4, 580, 330, 1.1),
        cam(3.0, 580, 330, 1.1),
        cam(3.6, 880, 330, 1.05),
        cam(5.2, 880, 340, 1.05),
        cam(6.4, 580, 340, 1.1),
        cam(7.2, 700, 405),
        cam(9.6, 700, 405, 1.04),
      ],
    },
    { text: NARRATION.enquiries, from: 0.3, to: 9.4 },
  );

  // 12 — montage
  const montage = [
    ['discover', 'cars', 'Discover.'],
    ['vehicle', 'photo-14', 'Discover.'],
    ['enquiry', 'sent', 'Connect.'],
    ['console', 'enquiries', 'Connect.'],
    ['console', 'reserved', 'Sell.'],
    ['dealer', 'portfolio', 'Sell.'],
  ];
  const montageStart = cursorTime;
  montage.forEach(([scene, name, word], i) => {
    add({
      kind: 'ui',
      dur: 1.55,
      fadeIn: 0.3,
      frame: 'card',
      cardScale: 0.64,
      cardShiftX: 0.16,
      shots: [S(scene, name, 0)],
      camera: [C(0, 0.96), C(1.55, 1.02)],
      stamp: word,
      squareFocusX: 720,
    });
    if (i === 0)
      narration.push({
        text: NARRATION.montage,
        from: montageStart + 0.2,
        to: montageStart + 1.25 * montage.length,
      });
  });

  // 13 — close
  add(
    {
      kind: 'title',
      dur: 6.6,
      fadeIn: 0.6,
      backdrop: 'dark',
      brand: { size: 64, delay: 0.2 },
      headline: 'A better digital marketplace<br/>for used cars.',
      headlineSize: format === 'portrait' ? 64 : 72,
      sub: `Discover. Connect. Drive.<br/><span style="opacity:.6;font-size:.8em">${CLOSING_URL}</span>`,
    },
    { text: NARRATION.close, from: 1.2, to: 6.2 },
  );

  const duration = cursorTime;
  const srt = narration
    .map(
      (line, i) =>
        `${String(i + 1)}\n${srtTime(line.from)} --> ${srtTime(line.to)}\n${line.text}\n`,
    )
    .join('\n');
  return { clips, duration, srt, narration };
}
