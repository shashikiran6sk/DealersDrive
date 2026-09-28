# web / app/(public)/enquiries

Parent: [web](../../README.md)

## `apps/web/src/app/(public)/enquiries/page.tsx`

### `export default async function MyEnquiriesPage(...)`

A customer's own enquiries (**R68**). In the public group so it wears the
customer header, but `force-dynamic`, read with `revalidate: false` and
`noindex`: it is one person's page and must never be cached or crawled. A
`401` — nobody signed in, or a session that is not a customer's — sends the
visitor to `/login?returnTo=/enquiries`, whose Customer tab is the default.
Only the cursor reaches the API.
