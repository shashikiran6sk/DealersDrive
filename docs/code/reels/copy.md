# reels / copy

Parent: [reels](README.md)

## `apps/reels/src/copy/copy.ts`

### `export const COPY`

Every line in the reel is bilingual: English first, Tamil under it, smaller. One
reel serves both audiences, which is simpler to distribute than two reels per
dealer and suits a market where buyers read both.

**The Tamil was written without a native-speaker review.** It uses the words
Tamil car buyers commonly use — transliterated trade words such as
எக்ஸ்சேஞ்ச் and ஆட்டோமேட்டிக் where those are what people say — but it
should be read by a native speaker before reels are published widely.
Everything to review is in this file and `tamil.ts`.

### `export function pricesAsOf(date: Date): Bilingual`

A reel outlives the prices in it. Every reel states the date its prices were
read, and the date is the render's `--as-of`, so a re-render refreshes it.

## `apps/reels/src/copy/tamil.ts`

### `export const TAMIL_PLACES`

Towns are free text on a dealer (**D6**), so there is no table of Tamil names
to read. This is a short map of the places dealers are in today; a town not in
it is shown in English only rather than transliterated by rule.
