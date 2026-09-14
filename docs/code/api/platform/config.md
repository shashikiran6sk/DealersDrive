# api / platform/config

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/config/platform-config.ts`

### `export interface ConfigDefinition`

`PlatformConfig` read through a 5-minute in-process cache (§18 layer L3).

The numbers here are the ones that drift between files if they live in code:
the photo minimum appears in the submit guard, the Zod schema, the advisory
flag and the wizard's copy, and "6 in three places and 5 in the fourth"
produces a submit button that fails with no visible reason (§10).

### `{ key: 'rcLookup.cacheDays', label: 'RC spec cache (days)', type: 'number', value: 30 }`

── RC lookup and the vehicle report ─────────────────────────────────────

### `{ key: 'rcLookup.cacheDays', label: 'RC spec cache (days)', type: 'number', value: 30 }`

Two knobs here are spend controls and one is a privacy decision. The

### `{ key: 'rcLookup.cacheDays', label: 'RC spec cache (days)', type: 'number', value: 30 }`

privacy one is `report.publicDetail`: OFF publishes aggregates and offence

### `{ key: 'rcLookup.cacheDays', label: 'RC spec cache (days)', type: 'number', value: 30 }`

types, ON publishes the itemised challan list. It is config rather than

### `{ key: 'rcLookup.cacheDays', label: 'RC spec cache (days)', type: 'number', value: 30 }`

code because it is a product judgement that may be revisited after seeing

### `{ key: 'rcLookup.cacheDays', label: 'RC spec cache (days)', type: 'number', value: 30 }`

the summary in production — but flipping it widens what every public

### `{ key: 'rcLookup.cacheDays', label: 'RC spec cache (days)', type: 'number', value: 30 }`

listing page discloses, so it is deliberately not a rendering choice a

### `{ key: 'rcLookup.cacheDays', label: 'RC spec cache (days)', type: 'number', value: 30 }`

component can make (ARCHITECTURE §6.1).

### `{ key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false }`

── feature flags ────────────────────────────────────────────────────────

### `{ key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false }`

Flags are platform config, not a second system. They get the same admin

### `{ key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false }`

screen, the same audit trail and the same cache — the only thing that makes

### `{ key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false }`

them a flag rather than a setting is the `feature.` prefix and the fact

### `{ key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false }`

that flipping one is expected to be an operational act rather than a

### `{ key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false }`

configuration change (§30).

### `{ key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false }`

Every flag here must be safe in BOTH positions at all times: the rollback

### `{ key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false }`

for a bad release is flipping it back, and that has to work without a

### `{ key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false }`

deploy, a migration or a data repair.

### line 86

Off: `/dealer/vehicles/new` opens on today's seven-dropdown Basics form.
On: it opens on the registration field, with the manual form one click
away. Both positions are complete flows, which is what makes this a safe
rollback rather than a half-disabled feature.

### line 98

Independent of `feature.rcLookup` on purpose. If a wording problem
surfaces on the public report, this pulls it from every buyer-facing page
without touching intake — which is the rollback you actually want at 9pm.

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

── where the platform can be found, off the platform ────────────────────

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

The footer's social row. These are configuration rather than code for one

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

reason worth stating: a marketing account is opened, renamed and closed on

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

a timescale that has nothing to do with a release, and an hour spent

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

waiting for a deploy to correct a dead Instagram link on every public page

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

is an hour nobody should have to spend.

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

**An empty string means "we do not publish one".** The footer renders no

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

icon at all for an empty value rather than a link to a profile that does

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

not exist — the same rule the console nav follows for a route that has not

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

landed. `GET /v1/config/public` additionally refuses anything that is not

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

an `https:` URL, so a typo, a `javascript:` URI or a bare handle drops out

### `{ key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' }`

of the payload instead of reaching a buyer's page (see `config.service.ts`).

### `export const CONFIG_READERS: Record<string, string> =`

Who reads each key, and the honest empty half (**F072**).

`CONFIG_DEFAULTS` above is the complete list — every knob the product will
ever have, brought across whole so the table does not grow a row per feature.
What is _not_ complete is the code that consults them: `listing.durationDays`
waits on the listing state machine, the reveal caps on contact reveal, the RC
knobs on the lookup port.

A settings screen that offered all of them equally would be lying by
omission — an operator who sets "minimum photos" to 8 and watches it save has
been told the platform now wants eight photos. So a key something reads names
its reader here, and `GET /v1/admin/config` hands that string to the console:
a key with no entry renders read-only, under "Not in use yet".

**Add the line in the same PR as the code that reads the key.** It is one
line, it sits beside the default it describes, and it is the only thing
between the settings screen and a page of decorative controls.

### `string(key: string): Promise<string>`

A `string` key, trimmed.

Trimmed here rather than at each caller because the value was typed into a
text box by a person, and a trailing space on a URL is the difference
between a link that works and one that 404s in a way nobody can see by
looking at the field.

### `flag(key: string): Promise<boolean>`

A `feature.*` flag. Distinct from `boolean()` only in that it refuses a key
that is not a flag, so a typo reads as a mistake rather than as `false`.

### `flags(): Promise<Record<string, boolean>>`

Every flag at once, for the dealer/admin bootstrap payload.

### `invalidate(): Promise<void>`

Drops this process's copy _and_ signals every other task to do the same.

### `export const FEATURE_PREFIX = 'feature.'`

The prefix that makes a setting a flag.

### `const TTL_MS = 5 * 60 * 1000`

How long a task will serve its own copy before re-reading the table.

This is the _outer_ bound, and it used to be the only one: an admin turning a
flag off waited up to five minutes for every task to notice. The version poll
below is what makes the usual case seconds instead (§30).

### `const VERSION_NAMESPACE = 'platform-config'`

The `CachePort` namespace under which the config version is bumped.

### `export function createPlatformConfig`

@param cache Shared state, used only to agree with other tasks about _when_
the table last changed. The config values themselves are never
stored there — the table is the record, and a cache that could
disagree with it would be a second source of truth.

### `let loadedVersion = 0`

The shared version this process's copy was built against.

### `let versionCheckedAt = 0`

When we last asked the cache for the shared version.

### `async function isStale(now: number): Promise<boolean>`

True when another task has written since our copy was built.

Deliberately fail-open: if the shared version cannot be read, we keep
serving the copy we have and fall back to the TTL. A cache blip must not
turn every config read into a table scan.

### `const rows = await prisma.platformConfig.findMany()`

Leave loadedVersion alone; the TTL is still a correct fallback.

### `try`

Signal the other tasks. A failure here is not a failed write — the row

### `try`

is committed, and every task still converges within the TTL — so it

### `try`

must not turn a successful save into an error for the admin.
