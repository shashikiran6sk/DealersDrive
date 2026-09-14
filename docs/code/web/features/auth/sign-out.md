# web / features/auth/sign-out

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/sign-out/sign-out.tsx`

### `export function SignOutButton(`

Sign out — a form, not a link. A GET that ends a session can be triggered by
any image tag on any page, so this posts. The Server Action revokes the row at
the API before clearing the cookie, which is the difference between signing
out and merely forgetting.
