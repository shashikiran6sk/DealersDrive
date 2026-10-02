# api / modules/team

Parent: [api](README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/team/team.service.ts`

### `export function createTeamService({ prisma, audit }: TeamDeps)`

**R94** — the owner's side of a dealership's team. Every route here needs
`member:manage`, which only OWNER holds (`DEALER_PERMISSIONS` in contracts).

### `export async function lockDealership(tx: Tx, dealerId: string): Promise<void>`

Every team write takes the dealership row `FOR UPDATE` first. Two owner devices
inviting the same number, or one removing a member while another changes their
role, are then simply one after the other: the second reads what the first
wrote. The partial unique index on waiting invitations is the backstop; this is
what makes the service's own reads trustworthy.

### `async invite(actor: TeamActor, input: InviteMemberInput): Promise<TeamInvitation>`

The number is normalised to the one canonical `+91…` form `users.phone` holds,
so the invitation and the account it may later meet compare as equal strings.
A number already waiting is **renewed** — new role, fresh seven days — rather
than invited twice; a number that already belongs to an active member is a 409.

The audit row records the role and whether an account already holds the
number, never the number itself: the invitation row is where the number lives,
and the audit log is read far more widely than the team.

### `export const MAX_WAITING_INVITATIONS = 25`

An invitation is a row, and it costs nothing to make one. Without a ceiling a
script, or an owner pasting a contact list, can fill `dealer_invitations` with
thousands of rows for one dealership. That makes the Team page unreadable and
turns every number into a standing claim for seven days.

Twenty-five is well above any real dealership's staff. It counts only
invitations that are both `PENDING` **and** unexpired, because an expired one
can no longer be accepted, so it should not hold a slot.

The count is taken **after** the dealership row is locked. Two invites sent at
once therefore cannot both see 24 and both insert.

Renewing a number that is already waiting skips the check. Changing the role on
an existing invitation adds no row, so it must never be refused for the
dealership being "full".

### `async function manageableMember(tx: Tx, actor: TeamActor, memberId: string)`

The OWNER is fixed in V1 — it can be neither demoted nor removed, and an owner
cannot act on their own row. That one rule is what makes "the dealership can
never be left without an owner" true without counting owners: there is only
ever the one, and nothing here can touch it. Ownership transfer, when it comes,
is a support action.

### `async removeMember(actor: TeamActor, memberId: string): Promise<void>`

`status = REMOVED` with who and when, never a delete. The audit trail and the
`contactedById` on enquiries the member worked still name a person, and an
invitation accepted later reactivates the same row — `UNIQUE(dealerId, userId)`
allows nothing else. Their session is not touched: they lose the dealership on
their next request because the resolver reads membership every time, and keep
their customer account.

## `apps/api/src/modules/team/invitations.service.ts`

### `async function lockOwnPending(tx: Tx, customer: CustomerPrincipal, invitationId: string)`

**What makes an invitation someone's is the number their session proved** —
never anything in the request. The lock is taken on `id AND phone`, so another
person's invitation is a 404 indistinguishable from one that does not exist,
and there is no token to forward, guess or replay. A replay of an accepted,
declined or withdrawn invitation is a 409 that names which, because by then the
person asking is the person it was for.

An expired invitation is refused without being written as EXPIRED: the refusal
rolls the transaction back, and every read already treats a waiting row past
`expiresAt` as expired (`effectiveStatus`).

### `async accept(`

Joining is not onboarding. Verification belongs to the dealership, which has
it, so the person is a member the moment this commits — with the role the
owner chose, read from the invitation at acceptance, not when it was sent.

Locks the invitation, then the dealership: two accepts of one invitation are
serialised on the first lock and the second finds it ACCEPTED; an owner's
removal or withdrawal racing an accept is serialised on the second. A
dealership suspended since the invitation was sent refuses it.

### `async mine(customer: CustomerPrincipal): Promise<MyInvitationsResponse>`

Only invitations a person can act on: waiting, unexpired, from an ACTIVE
dealership they are not already in. The inviter's name is read in one query for
the whole list.
