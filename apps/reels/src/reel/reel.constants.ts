export const REEL_COMPOSITION_ID = 'DealerReel';

export const REEL_FPS = 30;
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const REEL_SECONDS = 20;
export const REEL_DURATION = REEL_FPS * REEL_SECONDS;

export const SCENE_FRAMES = {
  opening: 60,
  services: 45,
  stock: 60,
  closing: 75,
} as const;

export const MAX_FEATURED_CARS = 8;
export const MAX_SERVICES = 6;
export const MAX_GALLERY_TILES = 9;

export const SAFE_AREA = {
  top: 230,
  bottom: 420,
  side: 72,
} as const;

export const COLORS = {
  ink: '#171716',
  black: '#0c0c0b',
  paper: '#f7f7f5',
  photo: '#f6f6f6',
  white: '#ffffff',
  rule: '#e4e3df',
  muted: '#6f6d68',
  faint: '#9a9892',
  outline: '#d6d5d0',
  ok: '#09835b',
  inkSoft: '#2c2c2a',
} as const;

export const FONT_STACK = "'Manrope', 'Noto Sans Tamil', Arial, sans-serif";
export const TAMIL_FONT_STACK = "'Noto Sans Tamil', 'Manrope', Arial, sans-serif";

export const IMAGE_WIDTH = 1600;
