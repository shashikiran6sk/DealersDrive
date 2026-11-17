export type FitOptions = {
  max: number;
  min: number;
  width: number;
  lines: number;
  charWidth?: number;
};

const DEFAULT_CHAR_WIDTH = 0.6;

export function fitFontSize(text: string, options: FitOptions): number {
  const { max, min, width, lines, charWidth = DEFAULT_CHAR_WIDTH } = options;
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length === 0) return max;

  const longestWord = Math.max(...clean.split(' ').map((word) => word.length));
  const byWord = width / (longestWord * charWidth);
  const byLines = (width * lines) / (clean.length * charWidth);

  return Math.round(Math.max(min, Math.min(max, byWord, byLines)));
}
