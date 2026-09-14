# web / components/auth

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/auth/auth-shell.tsx`

### `export function AuthShell(`

DESIGN-SPEC §3.9 — the shell every authentication screen sits in.

A centred 560px column on white, with the brand row above it: logo plate,
wordmark, and a ghost link back to the marketplace on the right. Sign-in,
onboarding and the admin console all use it, which is what keeps the three
screens recognisably one product rather than three forms.

Deliberately not a route layout: `/dealer/login` and `/dealer/onboarding` are
pages, but `/admin/login` lives under a different segment, and a shared
component crosses that boundary where a layout cannot.

### `export function AuthHeading({ title, children }: { title: string; children?: ReactNode })`

`h1-page` plus the 15px 65% line that follows it on every auth screen.

## `apps/web/src/components/auth/google-button.tsx`

### `export function GoogleSignInButton(`

"Continue with Google".

An `<a>`, not a button: the whole point of the authorization code flow is
that the browser _navigates_ to Google, and a fetch could not carry the
redirect. It is styled as `btn-secondary` with the Google mark on the left —
Google's identity guidelines ask for their wordmark and colours on a neutral
surface, which is also what the design system's secondary button is.

`disabled` renders the same control inert, for a deployment with no Google
credentials configured: a button that looks alive and fails on click is worse
than one that says why it cannot work.

### `<a className={className} href={href} rel="nofollow">`

A full page navigation, so `next/link`'s client router is not involved.

### `function GoogleMark()`

The four-colour mark, at the 18px Google specifies for a 44px control.
