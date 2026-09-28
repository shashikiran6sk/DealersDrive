# web / features/auth/sign-in-actions

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/sign-in-actions.ts`

### `export async function dealerPhoneSignInAction(`

**R63** — a phone sign-in is an API call made from this server, so the session
the API issues arrives as a `Set-Cookie` on a response the browser never
sees. `relaySessionCookie` copies it onto this response with the attributes
the API chose — including its `Domain`, so it is the same cookie the Google
callback sets, not a second one beside it.

### `(await cookies()).set(SIGN_UP_COOKIE, result.signUpToken, {`

A first-time customer's sign-up ticket (R62) is kept in an HttpOnly cookie on
this domain for the ten minutes it lives, and the page is told only that a
name is needed. Script on the page never sees the ticket; the next action
reads it back.

### `export async function customerSignUpAction(fullName: string): Promise<CustomerSignUpState>`

The name is validated with the same schema the API uses before anything is
sent. The ticket cookie is deleted once the account exists, and also when the
API says it has expired, so a retry starts again from the number instead of
presenting a dead ticket.
