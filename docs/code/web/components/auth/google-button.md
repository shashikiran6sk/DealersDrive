# web / components/auth/google-button

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/auth/google-button/google-button.tsx`

### `export function GoogleSignInButton(`

"Continue with Google". An `<a>`, not a button: the authorization code flow
needs the browser to _navigate_ to Google, and a fetch could not carry the
redirect. `disabled` renders the same control inert for a deployment with no
Google credentials — a button that looks alive and fails on click is worse
than one that says why it cannot work.

### `<a className={className} href={href} rel="nofollow">`

A full page navigation, so `next/link`'s client router is not involved.

## `apps/web/src/components/auth/google-button/google-mark.tsx`

### `export function GoogleMark()`

The four-colour mark, at the 18px Google specifies for a 44px control.
