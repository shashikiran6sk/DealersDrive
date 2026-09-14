# sandbox / mocks

Parent: [sandbox](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/sandbox/src/mocks/access-actions.ts`

### `export interface AccessResult`

A stand-in for `@/features/admin/access-actions` (**C-4**).

`AdminAccessPanel` is the one screen that hands out a cross-tenant seat, and
both of its writes are Server Actions. The stub records what it was asked to
do so a story can show the call, and delays so the pending state is visible.

## `apps/sandbox/src/mocks/admin-actions.ts`

### `export interface AdminResult<T = undefined>`

A stand-in for `@/features/admin/actions`.

The same coupling as `auth-actions.ts` (**C-4** in `component-map.md`):
`DealerAdminActions` calls Server Actions, which need a Next server, and the
sandbox renders with the network off. `.storybook/main.ts` aliases the real
module to this one.

The stubs are deliberately _slow and observable_ rather than instant. The
pending state is one of the states the story has to show, and an action that
resolved immediately would make it impossible to see — which matters more
here than at sign-in, because these two writes are the ones that put a
dealership's whole catalogue in front of buyers or take it away.

### `errors?: Record<string, string>`

Field-level refusals, keyed by the path the API answers with
(`body.address.city`). Only `updateDealerAction` returns them — it is the
one action here that renders a form rather than a single reason box.

### `export const adminActionStub:`

What the sandbox's actions do next. Set by a story before it renders.

### `export async function verifyDocumentAction(documentId: string)`

The two KYC decisions. They are keyed by document rather than by dealer, so
`dealerId` above carries the document id for these — the stub records what
was called with what, and a story asserts on the pair.

### `export async function rejectDealerAction(dealerId: string, input: unknown)`

The two refusals, which are two different things behind one word.

`requestDealerChanges` hands the application back as a draft with everything
in it; `rejectDealer` deletes the application. The stub records which was
called, which is the point — the console's job is to make a moderator's
choice between them deliberate, and a story asserts on the pair.

### `export async function updateDealerAction(dealerId: string, input: unknown)`

D3 — the console amending the dealer's own answers.

### `export async function approveProfileChangeAction(changeId: string)`

R34's two decisions, keyed by the change rather than by the dealership — so
`dealerId` above carries the change id for these, as it does for the KYC
pair.

## `apps/sandbox/src/mocks/auth-actions.ts`

### `export interface ActionState`

A stand-in for `@/features/auth/actions`.

Coupling **C-4** in `component-map.md`: `OnboardingWizard` and
`SignOutButton` call Server Actions, which need a Next server to exist. The sandbox has no
server and must render with the network off, so `.storybook/main.ts` aliases
the real module to this one — the pattern `component-sandbox.md` §8
prescribes, and the same one `apps/web/tests/setup.ts` already uses.

The stubs are deliberately _slow and observable_ rather than instant: the
submitting state is one of the states the story has to show, and an action
that resolved immediately would make it impossible to see.

### `export const authActionStub:`

What the sandbox's action does next. Set by a story before it renders.

### `export async function updateOnboardingAction`

Steps 1 and 2 again, for a dealership that already exists.

`Back` from the Documents step has to lead somewhere, and the create call
refuses a second dealership — so the same fields PATCH instead. Which of the
two the wizard uses is decided by whether `dealer` is null, so a story that
passes one exercises this path.

### `export async function saveBusinessIdsAction`

The GSTIN/PAN save on the Documents step (**F041**).

### `export async function submitForVerificationAction(): Promise<ActionState>`

The submit on the Review step (**F042**). Takes no form data.

## `apps/sandbox/src/mocks/config-actions.ts`

### `export interface ConfigResult`

A stand-in for `@/features/admin/config-actions`.

The same coupling as the other three stubs here (**C-4** in
`component-map.md`): `ConfigRow` writes through a Server Action, which needs
a Next server, and the sandbox renders with the network off.

Deliberately _slow_, like `admin-actions.ts`: saving is one of the states the
story exists to show, and an action that resolved instantly would make the
pending button impossible to look at.

## `apps/sandbox/src/mocks/dealer-actions.ts`

### `export interface ProfileFormState`

A stand-in for `@/features/dealer/profile-actions`.

The same coupling as `auth-actions.ts` and `admin-actions.ts` (**C-4** in
`component-map.md`): `DealerProfileForm` calls a Server Action, which needs a
Next server, and the sandbox renders with the network off.
`.storybook/main.ts` aliases the real module to this one.

The stub is deliberately _slow and observable_ rather than instant. The
pending state of the save button is one of the states the story has to show,
and an action that resolved immediately would make it impossible to see.

### `export const dealerProfileStub:`

What the sandbox's action does next. Set by a story before it renders.

### `export const withdrawStub: { delayMs: number; result: string | null; calls: number } =`

R34's Cancel. Resolves to `null` on success, or to a message.

`withdrawResult` is separate from `result` above because the two actions fail
for different reasons and a story usually wants one of them to work while the
other does not.

## `apps/sandbox/src/mocks/phone-actions.ts`

### `export interface PhoneVerificationState`

A stand-in for `@/features/auth/phone-actions` (**R39**).

Coupling **C-4** in `component-map.md`, for the same reason the auth actions
have one: `PhoneVerification` posts the widget's access token through a
Server Action, and the sandbox has no server. `.storybook/main.ts` aliases
the real module to this one.

What it must _not_ do is decide anything the real endpoint decides. The
component under test is the one that hands a token over and renders what
comes back — so this stub answers, slowly enough to see, whatever the story
set.

### `export const phoneActionStub:`

What the sandbox's verification answers. Set by a story before it renders.

### `export async function checkPhoneAvailabilityAction(phone: string): Promise<{ error?: string }>`

`POST /v1/auth/phone/availability` — asked before anything is sent.

Free by default. A story that wants the taken-number refusal sets
`phoneActionStub.availability`.
