# web / features/dealer/team

Parent: [web](../../README.md)

The owner's Team page at `/dealer/team` (**R94**), and the invited person's
`/invitations`.

## `apps/web/src/app/(dealer)/dealer/team/page.tsx`

### `export default async function TeamPage()`

The page asks the session — `canDealer(session.permissions, 'member:manage')` —
before it asks the API for anything, and anyone else is sent to the dashboard
rather than shown a screen of controls the API would refuse. The API's own
`requirePermission('member:manage')` is the authority; this is only the page
not pretending.

## `apps/web/src/features/dealer/team/team-panel.tsx`

### `export function TeamPanel({ team }: TeamPanelProps)`

Cards, not a table: the same `.card` list the enquiry inbox uses, so the page
reads the same at 390px as at 1366 and needs no second layout. The owner's own
card carries no controls — the owner is fixed in V1 — and everyone else's has a
role `Select` (it saves on change; the API refuses OWNER, so the Select never
offers it) and Remove behind a confirmation, because removal takes effect on
that person's next click.

Invitations sit below the members because they are not members yet. The hint
says the thing an owner most needs to know: nothing is sent — they tell the
person to sign in with that number.

## `apps/web/src/features/dealer/team/invite-member-dialog.tsx`

### `export function InviteMemberDialog({ onInvite }: InviteMemberDialogProps)`

Mobile number and a role, nothing else. The role is a radio pair rather than a
select, each with a sentence of what that role may do: an owner choosing
between Manager and Staff is choosing between those sentences, and they read
them once, here. Staff is preselected — the narrower grant is the safer default.
A refusal (already a member, not a mobile number) keeps the dialog open with the
API's sentence.

## `apps/web/src/components/dealer/console-nav/utils.ts`

### `export function consoleNavFor(permissions: readonly string[]): NavItem[]`

Team is in the console nav for an owner only. It has no `short`, so it takes
no slot in the five-tab bar below 768px (DESIGN-SPEC draws five); on a phone the
owner reaches it from the Team button on the Dealer profile page.

## `apps/web/src/features/invitations/invitation-item.tsx`

### `export function InvitationItem({ invitation }: InvitationItemProps)`

Accept and Decline, and nothing about who the person is: they are signed in,
and the API matches the invitation to the number that session proved. Accepting
calls `enterWorkspaceAction` with the new membership, so the person lands in the
dealer console in the same click, on the same session.

## `apps/web/src/features/auth/header-account/workspace-items.tsx`

### `const invitationItem =`

A waiting invitation is shown in the account menu, above the person's
dealerships, so somebody who was invited finds it the first time they sign in —
nothing else tells them, because nothing is sent.
