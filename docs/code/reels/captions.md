# reels / captions

Parent: [reels](README.md)

## `apps/reels/src/captions/captions.ts`

### `export function buildCaptions(input: CaptionInput): Captions`

Every rendered reel gets its Instagram caption and its YouTube Short title and
description, written next to the MP4 (`<slug>.instagram.txt`,
`<slug>.youtube.txt`). They are built from the same props as the video, so the
cars, prices, stock figure and date in the caption are the ones on screen and
cannot drift from them.

They are written as Dealers-Drive posting about a dealer, in the third person,
like the "Services offered" heading. No phone number appears (**AGENTS.md
rule 7**).

The two platforms differ where it matters:

- **Instagram** does not make links in captions clickable, so the caption
  carries no URL. It sends viewers through the link in the Dealers-Drive bio
  to the site, then to **Dealers** in the header and the directory's
  "Search dealership name" box, which is the one route to a dealer from the
  home page, as the home page has no dealer search. The QR code in the reel is
  offered as the shortcut. Instagram suggests three to five hashtags; the caption uses
  the brand, used-car, town and state tags plus up to three car brands from the
  reel.
- **YouTube** descriptions do link, so the dealer page is the second line,
  tagged `utm_source=youtube` so Shorts traffic is counted apart from reel
  scans. `#Shorts` leads the tags, and is in the title too.

### `export function youtubeTitle(input: CaptionInput): string`

YouTube cuts titles at 100 characters. The title leads with what a buyer
searches — the number of cars, the town and the starting price — and falls back
to a shorter form, then a trimmed dealer name, so it never exceeds the limit.

### `export function brandTags(cars: readonly ReelCar[], max: number): string[]`

There is no make field to read (**D1**), so a brand tag is the first word of a
featured title: `Maruti` for `Maruti Suzuki Ertiga VXI`, which is the tag people
use anyway.
