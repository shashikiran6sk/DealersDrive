# web / features/enquiry

Parent: [web](../README.md)

The notes below belong to the files named under each heading. Each heading is the
declaration the note sits above.

Enquire from the vehicle page (**R65**, on the API of **R64**). The page is
static — ISR, revalidated within a minute — and stays so: nothing about the
visitor is read while it renders. Who is signed in is asked only when somebody
presses **Enquire now**, by a Server Action, so one cached page serves every
visitor and the customer's name never reaches a shared cache.

## `apps/web/src/features/enquiry/actions.ts`

### `export async function enquiryCustomerAction(...)`

Asks `GET /v1/auth/customer/me` with the visitor's own cookie, and answers only
the two things the form shows — the name and the display form of the proved
number. A `401` is not an error here: it is the answer "not signed in as a
customer", and the panel sends the visitor to sign in. A dealer's session with a
proved number and a name counts as that customer (R62), because the API says so,
not because this file decides.

### `export async function sendEnquiryAction(...)`

Sends `{ listingSlug, message? }` and nothing else. The body is parsed with the
contracts `CreateEnquiryInput` first, so an over-long message is refused with
the API's own sentence and no round trip; an empty or whitespace-only message
is dropped rather than sent, matching what the API would store. There is no
name, phone or dealership in the request — those are the session's and the
listing's, and the API refuses them by name.

The answer is one of four: `sent` with the receipt; `signed-out` for a `401`
(the session ended between opening the form and pressing Send); `refused` with
the API's code and sentence; `invalid` for a message the contract refused.

## `apps/web/src/features/enquiry/enquiry-panel/enquiry-panel.tsx`

### `export function EnquiryPanel(...)`

Idle → checking → form → sent / already / gone.

- **Anonymous.** Pressing Enquire sends the visitor to
  `/login?returnTo=/car/<slug>?enquire=1`. `/login` opens on the Customer tab
  by default and returns through `safeReturnPath`, which keeps a same-site path
  with its query.
- **Back from sign-in.** `?enquire=1` sets `autoOpen`, and the form opens by
  itself — the customer does not press Enquire twice. The auto-open is guarded
  by a ref so it runs once per mount: `open` changes identity whenever the
  router or pathname does, and an effect keyed on it would reopen the form
  after a send. After a successful send the parameter is dropped with
  `router.replace(pathname)`, so a reload does not offer the form again.
- **Already enquired / no longer available.** `ENQUIRY_ALREADY_SUBMITTED_RECENTLY`
  and `LISTING_NOT_AVAILABLE` replace the form with a banner carrying the API's
  sentence, and no second Send is offered. The second is reachable because the
  page is cached for up to a minute after a car sells.
- **Mobile.** Below `lg` the Enquire button is also pinned as a bottom bar
  (DESIGN-SPEC §3.4 at 375: the 64px action bar with `--shadow-lg`); the page
  pads its bottom by the bar's height so the last line is never under it.

## `apps/web/src/features/enquiry/enquiry-panel/enquiry-form.tsx`

### `export function EnquiryForm(...)`

The customer's name and mobile are shown, not asked: they are read-only text,
and the mobile carries a `Verified` tag because only a completed OTP writes it.
The message is optional and capped at the contract's 1,000 characters.

A double-tap on a slow phone sends once: a ref is set synchronously on submit
and cleared only when the answer arrives, which a `pending` flag from
`useTransition` cannot do on its own — the second tap lands before React has
re-rendered the disabled button. The API's per-customer-per-car guard (R64) is
the backstop, not the mechanism.

## `apps/web/src/features/enquiry/enquiry-panel/enquire-from-url.tsx`

### `export function EnquireFromUrl(...)`

Reads `?enquire=1` with `useSearchParams`, which is why it is its own component:
on a statically rendered page `useSearchParams` must sit under a `Suspense`
boundary, and the page's fallback is the same panel without `autoOpen`, so the
button is in the static HTML and the query is only read in the browser.
