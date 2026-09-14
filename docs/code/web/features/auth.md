# web / features/auth

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/actions.ts`

### `export interface ActionState`

The writes that change who you are.

They are Server Actions rather than browser fetches, for one reason:
the session cookie has to be set and cleared server-side (ARCHITECTURE
§15.2). No token is ever handed to client JavaScript — there is nothing in
`localStorage`, nothing in a React state atom, and nothing a script on the
page could read.

### `values?: Record<string, string>`

What was submitted, so a rejected form re-renders with it rather than blank.

### `const ONBOARDING_FIELDS = [`

There is no `adminLoginAction` here any more.

Admin sign-in is a browser navigation to the API's `/v1/auth/admin/google/
start`, exactly as the dealer's is — no form, no credential crossing this
process, and no session for a Server Action to relay. The cookie is set by
the API on the callback.

### `const ONBOARDING_FIELDS = [`

The fields steps 1 and 2 carry between them, in one list.

They are echoed back on a rejection so a bad pincode does not cost the dealer
the other eight answers, and the list is written once because a field missing
from it fails silently — the form re-renders blank in exactly one box, which
is the kind of bug nobody reports.

### `export async function onboardingAction`

Dealer onboarding — the step between a verified Google identity and a tenant.

### `export async function updateOnboardingAction`

Steps 1 and 2 again, for a dealership that already exists.

`Back` from the documents step has to lead somewhere, and once a tenant has
been created the create path cannot be walked a second time — it would refuse
with `DEALER_ALREADY_EXISTS`. So the same two steps PATCH instead, which is
what `PATCH /v1/dealer` is partial for.

`phone` is deliberately not sent. It is the login identity, and changing it
needs an OTP round-trip on the new number that onboarding does not have.

### `await apiSend('PATCH', '/v1/dealer/onboarding', parsed.data)`

`/v1/dealer/onboarding`, not `/v1/dealer` (**R27**). The profile screen's
route now takes three fields — the year, the tagline and the services —
and this step is asking for the name, the address and the contact
details. A DRAFT dealership is one still answering those questions, or
one sent back to fix an answer, and that is exactly what the onboarding
route is guarded to.

### `export async function signOutAction(scope: 'dealer' | 'admin' = 'dealer'): Promise<void>`

Sign out, for either console.

The API call is what matters: it revokes the `sessions` row, so the token
stops working everywhere rather than merely being forgotten by this browser.
Clearing the cookie afterwards is housekeeping, and is deliberately done even
if the revoke failed — a browser holding a cookie it believes in is worse
than one that has to sign in again.

### `(await cookies()).delete(SESSION_COOKIE)`

Already expired, already revoked, API down — all end the same way.

### `export async function saveBusinessIdsAction`

C2, from onboarding step 3 — the two registrations the KYC review needs
alongside the uploaded documents (DESIGN-SPEC §3.10).

A separate write from the dealership itself because it happens after the
tenant exists, and because a dealer can come back to it: `PATCH /v1/dealer`
is partial, so filling one field never blanks the other.

### `await apiSend('PATCH', '/v1/dealer/onboarding', parsed.data)`

The onboarding route (**R27**) — GSTIN and PAN are verified against a

### `await apiSend('PATCH', '/v1/dealer/onboarding', parsed.data)`

document, so they are not on the profile screen's schema either.

### `export async function submitForVerificationAction(): Promise<ActionState>`

C4 — the last step of onboarding: hand the dealership to a moderator.

The dealer does not become ACTIVE here. This submits an _event_; the state
machine and an admin decide the rest (Rule 5), which is why the success path
lands on a "we're reviewing this" panel rather than on the dashboard.

### `function text(formData: FormData, key: string): string`

A form field as text. `FormData.get` can return a `File`, and `String(file)`
is `[object File]` — a value that would validate as a string and then be
saved as one. Anything that is not text reads as absent.

### `const FORM_FIELD: Record<string, string> = { line: 'addressLine' }`

A validation path, as the name of the input it belongs to.

The wizard's fields are flat — `city`, `addressLine`, `pincode` — and both
validators answer in paths: Zod with `['address', 'city']`, the API with
`body.address.city`. Neither matches an input, so before this an error
against anything nested rendered against no field at all: the dealer saw a
banner saying something was wrong and not one box highlighted. Taking the
leaf fixes every case but one, and `line` is that one.

### `const leaf = (parts.at(-1) ?? path).match(/^\d+$/)`

A numeric leaf is an array index, and there is no input named `0`.
`specialities` is the first array this form carries (**R26**), and Zod
answers a too-long entry with `['specialities', 2]` — so the index is
stepped over and the error lands on the box the dealer typed it into.

### `function apiFieldErrors(error: ApiError): Record<string, string>`

The same, for the field errors the API answers a 400 or a 409 with.

## `apps/web/src/features/auth/phone-actions.ts`

### `export interface PhoneVerificationState`

The server half of the phone check (**R39**).

A Server Action rather than a browser `fetch`, for the reason every write in
this app is one: the `dd_session` cookie is HttpOnly and is forwarded by
`lib/api.ts` on the server. No token is handed to client JavaScript, and the
API's base URL never has to become a `NEXT_PUBLIC_*` variable (rule 9,
ARCHITECTURE §15.3).

The access token does cross this boundary, in the other direction — the
widget minted it in the browser and it has to reach the API somehow. That is
safe precisely because it proves nothing on its own: only MSG91, asked with
the server-only auth key, can say what it is worth.

### `error?: string`

The one line the panel shows when it did not work.

### `revalidatePath('/dealer/onboarding')`

The onboarding page reads `phoneVerified` off `GET /v1/auth/me` to decide
what step 1 shows. Without this, a dealer who verifies and then reloads —
or who presses Back from step 3 — is asked for a code they have already
given, because the cached render still says the number was never proved.

### `export async function checkPhoneAvailabilityAction(phone: string): Promise<{ error?: string }>`

Is this number free, asked **before** a message is sent (**R39**).

The order step 1 works in is: is it a number, is it free, then send. Only the
third costs anything, and the second used to be answered by the verification
— so a dealer who typed a number another dealership holds paid for an SMS,
read the code off their own handset, and only then found out.

`204` is free. Anything else is the API's own sentence, which is rendered
against the phone box rather than as a banner: the refusal is about the value
in front of them.
