# api / modules/config

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/config/config.docs.ts`

### `export const configDocs: ModuleDocs =`

A14. The client-safe slice of `platform_config`.

── D1 ────────────────────────────────────────────────────────────────────
Also lifted out of the removed `catalog.docs.ts`. It was never catalogue
data in the first place — it shared that tag only because both responses
were public reference data fetched by the same shell.

## `apps/api/src/modules/config/config.facade.ts`

### `export type { ConfigService } from './config.service.js'`

`config` as other modules see it (ARCHITECTURE §5.5 rule 3).

Nothing outside this module constructs the service — the container does the
wiring, and every other module that needs a setting takes the
`PlatformConfigService` port directly rather than going through here.

## `apps/api/src/modules/config/config.routes.ts`

### `const ROUTES: ConfigRoute[] = [getConfigPublic]`

A14 — public, cached at the edge, no session anywhere.

## `apps/api/src/modules/config/config.service.ts`

### `export interface ConfigDeps`

The public bootstrap payload — everything the browser needs to know about
this deployment, and nothing it does not.

── Relocated by decision D1 ────────────────────────────────────────────────
In the baseline this is `publicConfig()` on `catalog.service.ts`, sharing a
module with the vehicle catalogue D1 removes. It never belonged there: it
reads `PlatformConfig` and `env`, and touches no catalogue table. The body is
unchanged; only its address is.
────────────────────────────────────────────────────────────────────────────

Why the flags are read here rather than in the web app: a flag flip has to
take effect without a redeploy, and `NEXT_PUBLIC_*` is inlined at build time
(Rule 9). Reading them server-side and shipping them in this payload is what
keeps build-once-promote-many intact.

### `const SOCIAL_NETWORKS: { key: string; network: SocialLink['network']; label: string }[] = [`

The networks the footer can draw, in the order it draws them (**R44**).

The order is here rather than in the component because it is one list, and a
second copy of it in the web app would be a second thing to keep in step —
the footer renders what it is handed, in the order it is handed.

### `function socialHref(value: string): string | null`

A configured social URL, or `null`.

**This is a guard, not a tidy-up.** The values behind it are typed into a
text box on `/admin/config` and rendered into an `href` on every public page
in the product, which is precisely the shape of an injected `javascript:` or
`data:` URI — so the scheme is checked here, once, on the way out, rather
than trusted at six render sites. `https:` only: a marketing profile served
over plain HTTP in 2026 is a mistake worth refusing rather than proxying to a
buyer, and an unparseable value is a typo the operator should see as a
missing icon rather than as a dead link.

### `rcLookupEnabled: rcLookup`

Which intake screen to open, and whether listing pages carry a

### `rcLookupEnabled: rcLookup`

records check. Both are read here rather than in the web app so a

### `rcLookupEnabled: rcLookup`

flag flip takes effect without a redeploy.

### `social`

Only the networks that have a publishable URL. The footer draws what

### `social`

it is given, so "no Instagram account yet" is an absent entry here

### `social`

rather than a rule in a component.
