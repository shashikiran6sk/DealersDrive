# web/app/api/dealer/portfolio

Parent: [web/app/api/dealer](README.md)

The BFF the portfolio manager uploads through (**#299**). The browser cannot
reach the API without a public origin in the bundle (rule 9), so each route
parses its body with the contract the API validates with — a field the schema
does not name is a 400 here — and forwards with the session cookie.

## `apps/web/src/app/api/dealer/portfolio/presign/route.ts`

### `export async function POST(request: Request)`

`PortfolioPhotoPresignInput`, then `POST /v1/dealer/portfolio/presign`. A 409
`PORTFOLIO_FULL` passes through as a problem body so the dialog can show the
API's sentence.

## `apps/web/src/app/api/dealer/portfolio/commit/route.ts`

### `export async function POST(request: Request)`

`PortfolioPhotoCommitInput`, then the commit. It does not revalidate the public
page: a committed photograph is `PENDING`, and pending photographs are never
public, so nothing a buyer can see has changed.

## `apps/web/src/app/api/dealer/portfolio/[id]/route.ts`

### `export async function DELETE(_request, { params })`

Removing an approved photograph takes it off the public page, so this one does
revalidate the dealership's cached page, by the slug in the session.
