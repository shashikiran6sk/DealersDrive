const PAINTS = {
  WHITE: [
    { base: '#f4f5f4', light: '#ffffff', dark: '#c9ccce', name: 'polar white' },
    { base: '#eeece6', light: '#fbfaf6', dark: '#c4c1b8', name: 'pearl white' },
  ],
  SILVER: [
    { base: '#c3c7cb', light: '#eceef0', dark: '#8a9096', name: 'silver' },
    { base: '#b8bcc0', light: '#e2e5e8', dark: '#7d8388', name: 'titanium silver' },
  ],
  GREY: [
    { base: '#6d7277', light: '#9da2a7', dark: '#3f4347', name: 'titan grey' },
    { base: '#80858a', light: '#b1b5b9', dark: '#4c5054', name: 'magnetic grey' },
  ],
  BLACK: [{ base: '#1d1f22', light: '#4a4e53', dark: '#0b0c0d', name: 'phantom black' }],
  RED: [
    { base: '#b3202a', light: '#e2515a', dark: '#6d0f15', name: 'fiery red' },
    { base: '#8e1c26', light: '#bd4652', dark: '#520b12', name: 'wine red' },
  ],
  BLUE: [
    { base: '#1f4e8c', light: '#4f82c4', dark: '#0f2a4f', name: 'ocean blue' },
    { base: '#253b5e', light: '#526a92', dark: '#111e33', name: 'midnight blue' },
  ],
  GREEN: [{ base: '#2f5d4a', light: '#5d8d78', dark: '#17332a', name: 'forest green' }],
  BROWN: [{ base: '#6a4a36', light: '#9b7760', dark: '#3a271c', name: 'bronze brown' }],
  BEIGE: [{ base: '#cdbb9b', light: '#ece0c8', dark: '#9b8a6d', name: 'champagne beige' }],
  YELLOW: [{ base: '#e2b21f', light: '#f6d467', dark: '#9c7507', name: 'sunburst yellow' }],
  ORANGE: [{ base: '#d4661f', light: '#f29455', dark: '#8a3b0b', name: 'copper orange' }],
  OTHER: [
    { base: '#1f6b6b', light: '#4f9c9c', dark: '#0c3b3b', name: 'teal' },
    { base: '#5b2a44', light: '#8a5673', dark: '#331425', name: 'plum' },
  ],
};

export function paintFor(color, random) {
  const options = PAINTS[color] ?? PAINTS.OTHER;
  return options[Math.floor(random() * options.length)];
}

export function isLightPaint(paint) {
  const hex = paint.base.replace('#', '');
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export const INTERIORS = [
  {
    name: 'black',
    seat: '#26282c',
    seatLight: '#3a3d42',
    seatDark: '#141518',
    trim: '#1a1b1e',
    dash: '#1e2023',
    accent: '#8b9096',
    stitch: '#5a5e63',
  },
  {
    name: 'dual-tone beige',
    seat: '#c9b99d',
    seatLight: '#e0d3bb',
    seatDark: '#9c8c72',
    trim: '#2a2b2e',
    dash: '#232427',
    accent: '#b9a27a',
    stitch: '#8e7d62',
  },
  {
    name: 'grey',
    seat: '#55595f',
    seatLight: '#6f747a',
    seatDark: '#35383c',
    trim: '#1f2124',
    dash: '#222427',
    accent: '#9aa0a6',
    stitch: '#80858b',
  },
  {
    name: 'tan',
    seat: '#8a5a3b',
    seatLight: '#a87654',
    seatDark: '#5c3923',
    trim: '#1d1e21',
    dash: '#202124',
    accent: '#b98a5e',
    stitch: '#c79a6e',
  },
];

export const BACKDROPS = {
  studioLight: {
    wallTop: '#e9ebee',
    wallBottom: '#f7f8f9',
    floorTop: '#e4e6e9',
    floorBottom: '#cfd3d8',
    horizon: 0.64,
    shadow: 0.55,
    reflect: 0.16,
  },
  studioWarm: {
    wallTop: '#e8e1d6',
    wallBottom: '#f6f1ea',
    floorTop: '#e2d9cc',
    floorBottom: '#c9bdad',
    horizon: 0.64,
    shadow: 0.5,
    reflect: 0.14,
  },
  studioDark: {
    wallTop: '#15171a',
    wallBottom: '#2a2d32',
    floorTop: '#2b2e33',
    floorBottom: '#101113',
    horizon: 0.64,
    shadow: 0.75,
    reflect: 0.22,
  },
  studioCool: {
    wallTop: '#dfe5ea',
    wallBottom: '#f1f4f6',
    floorTop: '#d9e0e6',
    floorBottom: '#b9c3cc',
    horizon: 0.64,
    shadow: 0.55,
    reflect: 0.16,
  },
};
