# api / modules/media/routes

Parent: [api](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/media/routes/get-media-image.ts`

### `res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')`

These bytes stand in for the R2/Cloudflare Images origin, which is a

### `res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')`

different host from the web app in every environment. Helmet's

### `res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')`

default `same-origin` would stop the browser embedding them, so this

### `res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')`

route sends what a public media origin sends (§12.1). It applies to

### `res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')`

this route only — the JSON API keeps the strict default.
