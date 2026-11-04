# reels / cli

Parent: [reels](README.md)

## `apps/reels/src/cli/render.ts`

### `async function main(): Promise<void>`

The order is fetch everything, download everything, bundle once, render each. A
dealer whose data cannot be fetched stops the run before any rendering has
started, rather than leaving half a batch behind, and the bundle — the slowest
step after rendering itself — is built once for every reel.

Sound is staged with the images: the generated bed and whoosh are written to
`.cache/public/audio` on every run (they take about a second and a half, and
regenerating means a change to the score is never masked by a stale file).
`--music` replaces the bed but keeps the whooshes; `--silent` drops both, for a
reel that will be posted with a track from Instagram's own music library.

`REELS_BROWSER_EXECUTABLE` points Remotion at an existing Chrome headless shell.
Without it Remotion downloads its own, which is right on a workstation and
impossible in a sandbox with no route to the download host.

Each run writes the props it rendered with to `.cache/props/<slug>.json`, which
Remotion Studio can open (`--props`) to preview or adjust one dealer's reel.

## `apps/reels/src/cli/args.ts`

### `export function parseRenderArgs(argv: readonly string[], now: Date): RenderOptions`

`strict` parsing, like every input in this repository: `--dealers` is an error
naming the option, not a silent render of every dealership.
