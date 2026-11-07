# reels

Parent: [docs/code](../README.md)

`apps/reels` renders a 20-second vertical promo reel (1080×1920, 30 fps, H.264)
for every dealership that has live inventory. One Remotion composition,
`DealerReel`, is filled with each dealer's public data and rendered once per
dealer by `pnpm --filter @dealers-drive/reels render`.

It reads only what the public site already shows — the dealer directory, the
public profile and the public inventory — through the same Zod schemas in
`packages/contracts` that the web app parses with. It needs no database, no
credentials and no route of its own, and it publishes nothing on its own: the
output is MP4 files on disk.

## Why Remotion

The reel is a template filled with data a hundred times, not a video edited
once. Remotion makes the template a React component, so it is written in the
language and stack this repository already uses, typed against the contracts,
and re-rendered whenever inventory changes, with no hand editing. Its licence is
free for individuals and companies of up to three people; a larger company needs
a Remotion company licence before using this commercially.

## Why the coverage gate covers only part of `src`

`vitest.config.ts` gates `src/data`, `src/copy`, `src/lib`, `src/audio`, `src/captions` and `src/cli/args.ts`
at 90 %, like the other packages. The scenes in `src/components` and the
rendering entry `src/cli/render.ts` are excluded: a scene's correctness is how a
frame looks, and the check for that is rendering a reel and looking at it, which
the PR does with real dealers. Everything a scene decides _with_ — which cars,
in what order, for how many frames, in which words — lives in the gated folders
so that it is tested rather than eyeballed.

## Pages

- [data](data.md)
- [copy](copy.md)
- [lib](lib.md)
- [components](components.md)
- [cli](cli.md)
- [audio](audio.md)
- [captions](captions.md)

## Why `remotion bundle` warns about `zod`

Remotion 4.0.538 pins `zod@4.5.4` (through Studio), which `pnpm audit` reports
as high severity. The root `package.json` overrides it to `^4.6.6`, like the
other overrides there, so `remotion bundle` prints a version-mismatch warning.
Remotion uses `zod` for Studio's schema-driven props editor, which this
composition does not use; the warning is expected and the reels render normally.
Drop the override when a Remotion release ships a patched `zod`.
