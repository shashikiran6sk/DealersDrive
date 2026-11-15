# api / platform/archive

Parent: [api/platform](README.md)

## `apps/api/src/platform/archive/zip.ts`

### `export function storedZip(entries)`

A zip with every entry STOREd, not deflated. JPEG, PNG and WebP are already
compressed — deflate would cost CPU for a percent or two — so the archive is the
files back to back with headers, and the only computation is a CRC-32, which
`node:zlib` provides. That is the whole reason there is no archive dependency.

Names are flagged UTF-8 (general-purpose bit 11). There is no ZIP64: a listing's
photographs are at most sixteen files of at most `IMAGE_MAX_BYTES`, nowhere near
4 GB or 65,535 entries. `tests/zip-reader.ts` reads the result back in the tests,
and an archive was checked with Python's `zipfile` when it was written.
