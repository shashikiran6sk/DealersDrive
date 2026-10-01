# web / features/support

Parent: [web/features](README.md)

## `apps/web/src/features/support/support-page/support-request-callout.tsx`

### `export function SupportRequestCallout()`

**R90.** The `/contact` page leads with a structured support request; the email,
phone and WhatsApp cards (R81) stay underneath as "Other ways to reach us". The
button is a plain link to `/support-requests/new`. That page decides who is
signed in, on the server, and sends anybody else through the customer login and
back, so `/contact` stays a static public page with no session read.

## `apps/web/src/features/support/support-requests/support-request-list.tsx`

### `export function SupportRequestList({ tickets })`

One area, `/support-requests`, for creating and following requests — the
customer pages' convention (`/enquiries`, `/saved`) rather than a nested
`/account/…` tree, and not split into separate create and track pages. Cards,
not a table: the page is used on phones, and a card per request keeps the
reference, subject, status, topic and last update together.

## `apps/web/src/features/support/support-requests/support-request-form.tsx`

### `export function SupportRequestForm(props)`

The enquiry picker appears only for the topics it helps (`ENQUIRY_RELATED_CATEGORIES`)
and lists the customer's own enquiries, read from `GET /v1/enquiries`. The page
reads it on the server, so the browser is never trusted to say which enquiries
are theirs — and the API checks again on write.

`inFlight` is the duplicate-submit guard: a second press while the first is in
flight does nothing, so a slow network cannot create two requests. There is no
priority control; priority is support's.

## `apps/web/src/features/support/support-requests/support-request-detail.tsx`

### `export function SupportRequestDetail({ ticket })`

The conversation is the original request followed by the replies. Each bubble is
labelled with its author ("You", "Dealers-Drive support") as text, so the two
sides are told apart without relying on the alignment or the accent border. A
closed request shows no reply box but a pointer to a new request, which is what
the API would answer anyway.

## `apps/web/src/features/support/support-actions.ts`

### `createSupportRequestAction(draft)` · `replySupportRequestAction(ticketId, message)`

Each action checks its input with the same contract the API validates with
before calling it, and returns the field errors in the form's shape. A `401`
becomes `signed-out`, and the component sends the customer to log in with a
`returnTo` that brings them back to the same form or request.
