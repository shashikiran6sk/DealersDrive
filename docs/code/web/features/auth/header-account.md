# web / features/auth/header-account

Parent: [web](../../README.md)

The signed-in customer in the header (**R67**).

## `apps/web/src/features/auth/customer-account-actions.ts`

### `export async function customerAccountAction(): Promise<CustomerAccount | null>`

The account, for a server component that renders the person's corner itself —
the dealer console's top bar. It is `lookupCustomerAccount` collapsed to "the
account or null". The public header no longer calls it: see `/api/account`.

### `export async function enterWorkspaceAction(membershipId: string): Promise<void>`

Enters a dealership with the session the person already has (**R93**):
`PUT /v1/auth/workspaces/current` with the membership, then the console. No
OTP, no Google, no new cookie — the whole of "one login".

### `export async function customerLogoutAction(): Promise<void>`

`POST /v1/auth/customer/logout` revokes the session row, then the cookie is
dropped here. The cookie goes even when the API cannot be reached — the
visitor asked to be signed out of this browser, and that part is ours to do.
The `dd_auth` hint is set to signed out in the same response (**R103**).

## `apps/web/src/features/auth/customer-account.ts`

### `export async function lookupCustomerAccount(): Promise<CustomerAccountLookup>`

The lookup itself, shared by the action and `GET /api/account`.

- **No session cookie, no request.** Most visitors have no `dd_session`, and for
  them this answers `signed-out` without touching the API.
- **Three reads at once.** The account, the person's dealerships (**R93**) and
  their waiting invitations go out together. A failure in either of the last two
  is an empty list or a zero, never a failed account.
- **`signed-out` is not `unavailable`.** A `401` is signed out. Anything else —
  a timeout, a 5xx — is `unavailable`, which the route answers with a 503 and
  which must not be written down as "signed out" (**R103**).

## `apps/web/src/features/auth/header-account/account-client.ts`

### `export const fetchCustomerAccount: AccountLoader`

The browser side of `GET /api/account`: no-store, same-origin, cancelled when
the header unmounts and after 10 seconds at most, and parsed with Zod rather
than trusted. A failure throws; the header turns it into Login.

## `apps/web/src/features/auth/header-account/header-account.tsx`

### `export function HeaderAccount()`

**What is drawn before the answer (R103).** The public pages are static, so the
server renders both a Login button and a 40px avatar placeholder, and the
`dd_auth` hint picks one before first paint
([lib](../../lib.md#appswebsrclibauth-hintts)):

| `dd_auth`        | before hydration | after hydration            | asks `/api/account`? |
| ---------------- | ---------------- | -------------------------- | -------------------- |
| `0` (signed out) | Login            | Login                      | no                   |
| `1` (signed in)  | placeholder      | placeholder → avatar       | yes                  |
| absent           | placeholder      | placeholder → avatar/Login | yes                  |

Login is never shown to somebody who might be signed in; the placeholder and the
avatar are the same size, so nothing moves when the name arrives. If the lookup
fails, Login is shown — the one thing that is always safe to offer — and the hint
is left alone so the next page asks again.

An account handed in by a server component (the console's `initialAccount`) is
used as it is, and written to the hint, which is how a Google sign-in landing in
the console teaches the public pages that the person is signed in.

**Logout and entering a dealership** run through `useNavigationSafeAction`, not
`useTransition`, so a slow logout does not hold every link on the page. Logout
announces the new hint at once.

Below `sm` the greeting is visually hidden and the customer's initials stand in
for it, because the full phrase and Logout do not fit beside the district chip
at 375px; the full name is in the corner's `title` at every width.

**My enquiries (R68).** A signed-in customer gets a `My enquiries` link beside
the greeting; below `sm`, where there is no room for it, the initials avatar is
that link.

### `export function firstNameOf(fullName: string): string`

"Hi, Asha" rather than "Hi, Asha Menon": the header is a greeting, not an
account label, and a long name would crowd the district chip.

## `apps/web/src/features/auth/header-account/workspace-items.tsx`

### `export function WorkspaceItems(`

The menu's dealerships (**R93**). One item per enterable membership — the
dealership's name, then "Dealer dashboard · role" — and the one this session is
working in marked `aria-current`. A suspended dealership is listed as text, not
as an item: the person should see why it is missing, but there is nothing to
press. Somebody with no dealership sees Dealer Login instead, which goes to the
Dealer tab of `/login` rather than through `/dealer` and its "session expired"
error.

The same menu is in the dealer console's top bar, given the account by the
server layout (`initialAccount`), so the personal links and the other
dealerships are one click away from inside the console, and Logout there goes
home rather than to a login screen.
