# reels / lib

Parent: [reels](README.md)

## `apps/reels/src/lib/timeline.ts`

### `export function buildTimeline({ hasServices, carCount, total = REEL_DURATION }: TimelineInput): Timeline`

The reel is always exactly 20 seconds, whatever the dealer has. The opening,
stock and closing scenes are fixed; the cars get what is left. A dealer with no
services listed skips that scene and its two seconds go to the cars, and fewer
than four cars get longer each — so a short inventory never produces a short or
padded reel.

Every fixed scene and every car is a whole number of beats of the 120 BPM bed
(15 frames a beat at 30 fps): 4 beats of opening, 3 of services, 3 per car, 4 of
stock, 5 of closing. So every cut, and the whoosh on it, lands on the beat. A
dealer with no services or fewer cars still cuts on the frames the timeline
gives, which stay close to the grid. A test holds the full reel to the grid.

## `apps/reels/src/lib/motion.ts`

### `const cubic = (t: number): number => t * t * t;`

The same curve as Remotion's `Easing.cubic`, written out because passing the
library's method as a value trips `@typescript-eslint/unbound-method`.

### `export function enter(frame: number, fps: number, options: EnterOptions = {}): number`

A spring left to settle by itself takes about a second, and a car gets one and a
half. Text that is still moving cannot be read, so reveals pass a fixed
`durationInFrames` and are finished well inside the first second.

## `apps/reels/src/lib/fit-text.ts`

### `export function fitFontSize(text: string, options: FitOptions): number`

Remotion renders in a real browser, but a frame cannot be measured before it is
drawn without a second pass. Manrope's average glyph is about 0.6 em wide, so
sizing by the longest word and by the total length is accurate enough to keep a
dealer's name inside three lines and a car title inside two.

## `apps/reels/src/lib/qr.ts`

### `export function qrMatrix(text: string): boolean[][]`

The QR code is drawn as SVG squares from the matrix, not as a bitmap, so it stays
sharp after H.264 compression and scans from a phone held up to another phone.
Error correction is `M`: enough to survive compression without making the code
dense.
