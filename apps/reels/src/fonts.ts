import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/noto-sans-tamil/400.css';
import '@fontsource/noto-sans-tamil/600.css';
import '@fontsource/noto-sans-tamil/700.css';

import { cancelRender, continueRender, delayRender } from 'remotion';

const LATIN_SAMPLE = 'Aa ₹ 0123456789';
const TAMIL_SAMPLE = 'தமிழ் கார்கள்';

const FACES: ReadonlyArray<[string, string]> = [
  ['400 40px Manrope', LATIN_SAMPLE],
  ['600 40px Manrope', LATIN_SAMPLE],
  ['700 40px Manrope', LATIN_SAMPLE],
  ['800 40px Manrope', LATIN_SAMPLE],
  ['400 40px "Noto Sans Tamil"', TAMIL_SAMPLE],
  ['600 40px "Noto Sans Tamil"', TAMIL_SAMPLE],
  ['700 40px "Noto Sans Tamil"', TAMIL_SAMPLE],
];

export function loadFonts(): void {
  const handle = delayRender('Loading the reel fonts');
  Promise.all(FACES.map(([face, sample]) => document.fonts.load(face, sample)))
    .then(() => continueRender(handle))
    .catch((error: unknown) => cancelRender(error));
}
