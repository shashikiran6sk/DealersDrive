# web / app/(auth)

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(auth)/layout.tsx`

### `export default function AuthLayout({ children }: { children: ReactNode })`

DESIGN-SPEC §3.9 — the authentication screens sit on white, not on the
`#f4f5f7` page ground the rest of the product uses. The column inside is
`AuthShell`; this exists only to own the field it sits on, which no page
should have to set for itself.
