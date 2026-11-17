# reels / audio

Parent: [reels](README.md)

## `apps/reels/src/audio/score.ts`

### `export function renderBed(options: BedOptions): Mix`

The reel's music is synthesised in code, not taken from a library. A licensed
track cannot be committed or bundled into every dealer's reel, and royalty-free
tracks still carry terms that differ by platform. A generated bed is ours
outright, is identical on every render, and is arranged to this reel's timeline
rather than cut to fit it.

The arrangement follows the scenes: a filtered riser under the opening, the beat
dropping with a crash exactly as the services scene arrives (`dropIn`), and a
low boom with a crash when the closing scene starts (`dropOut`). The drums stop
there and a held chord rings under the QR code. Both moments are computed from
`SCENE_FRAMES`, so changing the pacing moves the music with it.

The harmony is a four-chord loop (Am – F – C – G) with a sixteenth-note pluck
arpeggio and an off-beat bass, and the chords and bass are ducked by every kick:
the "pumping" common in short-form social video, which keeps the beat legible on
a phone speaker.

The mix favours the mid and high frequencies on purpose. Phone speakers barely
reproduce anything under about 150 Hz, so a mix balanced for headphones sounds
like a ticking kick and nothing else on a phone. Measured over the main section,
the 150 Hz–2 kHz band sits within about 2 dB of the band below it, and the band
above 2 kHz about 9 dB under that. The bed is soft-clipped and normalised to
a 0.9 peak, about −10.5 LUFS integrated; Instagram turns louder uploads down,
not quieter ones up.

The bass plays an octave up on the off-beats for the same reason: its harmonics
fall where a phone speaker can play them.

## `apps/reels/src/audio/sfx.ts`

### `export function renderWhoosh(sampleRate: number, seed = 7): Mix`

A noise sweep that peaks at `WHOOSH_PEAK_AT` and pans left to right. The
soundtrack starts each whoosh that many frames before a cut, so its loudest
point lands on the cut itself. It is mixed well under the music, because a reel
with eight cars has eleven cuts in twenty seconds.

## `apps/reels/src/audio/prng.ts`

### `export function seededRandom(seed: number): () => number`

Every noise source is seeded, so the bed is byte-identical from run to run and
a test can compare two renders exactly. `Math.random` would make each reel's
hats and claps subtly different.

## `apps/reels/src/audio/filter.ts`

### `export class Svf`

A zero-delay-feedback state-variable filter (Simper's form). The simpler
Chamberlin filter goes unstable above about a sixth of the sample rate, which is
where the hi-hats are filtered; this form is stable at any cutoff, and the
cutoff is capped below Nyquist besides.

## `apps/reels/src/lib/pick.ts`

### `export function sampleAt(samples: ArrayLike<number>, index: number): number`

`noUncheckedIndexedAccess` types every read of a typed array as possibly
`undefined`. Reading through this helper, which treats an out-of-range index as
silence, keeps the DSP loops free of `?? 0` fallbacks that can never run.
