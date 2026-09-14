# web / components/auth/auth-shell

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/auth/auth-shell/auth-heading.tsx`

### `export function AuthHeading({ title, children }: { title: string; children?: ReactNode })`

`h1-page` plus the 15px 65% line that follows it on every auth screen.

## `apps/web/src/components/auth/auth-shell/auth-shell.tsx`

### `export function AuthShell(`

DESIGN-SPEC §3.9 — the shell every authentication screen sits in. A centred
560px column on white with the brand row above it, shared by sign-in,
onboarding and the admin console.

Deliberately not a route layout: `/admin/login` lives under a different
segment, and a shared component crosses that boundary where a layout cannot.
