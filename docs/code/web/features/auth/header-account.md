# web / features/auth/header-account

Parent: [web](../../README.md)

The signed-in customer in the header (**R67**).

## `apps/web/src/features/auth/customer-account-actions.ts`

### `export async function customerAccountAction(): Promise<CustomerAccount | null>`

Every public page renders the header, and the public pages are static, so who
is signed in cannot be known while they render. The header asks once, in the
browser, through this action.

- **No session cookie, no request.** The overwhelming majority of visitors
  have no `dd_session`, and for them this answers `null` without touching the
  API — the check costs a public page nothing.
- **Never an error.** A `401` (a dealer session with no proved number, or an
  expired one) and an unreachable API both answer `null`: a header that fails
  to learn a name shows Login, which is always a safe thing to show.
- It returns the name only. The number is the enquiry form's business (R65),
  not the header's.

A dealer whose account has a proved number and a name counts as that customer
(R62), so a dealer browsing the marketplace sees their own name here, and
Logout ends that one session.

### `export async function customerLogoutAction(): Promise<void>`

`POST /v1/auth/customer/logout` revokes the session row, then the cookie is
dropped here. The cookie goes even when the API cannot be reached — the
visitor asked to be signed out of this browser, and that part is ours to do.

## `apps/web/src/features/auth/header-account/header-account.tsx`

### `export function HeaderAccount()`

Renders Login first — so the static HTML, a visitor without JavaScript and a
failed check all get the right thing — and swaps to "Hi, first name" and Logout
once the action answers. After Logout it shows Login again and refreshes the
route, so anything on the page that depended on the session redraws.

Below `sm` the greeting is visually hidden and the customer's initials stand in
for it, because the full phrase and Logout do not fit beside the district chip
at 375px; the full name is in the corner's `title` at every width.

**My enquiries (R68).** A signed-in customer gets a `My enquiries` link beside
the greeting; below `sm`, where there is no room for it, the initials avatar is
that link.

### `export function firstNameOf(fullName: string): string`

"Hi, Asha" rather than "Hi, Asha Menon": the header is a greeting, not an
account label, and a long name would crowd the district chip.
