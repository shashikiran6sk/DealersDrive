# api / modules/admin-members

Parent: [api](README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/admin-members/admin-members.service.ts`

### `export function createAdminMembersService({ prisma, audit }: AdminMembersDeps)`

**R111** — the Super admin's management of internal team members: invite,
change role, disable, re-activate, and read a member's history. Every route
needs `admin:access:manage`, and the module is mounted under `/v1/admin`, so it
is also behind the `admin:console` gate.

Three refusals protect the platform from locking itself out:

- **yourself** (`403 ADMIN_MEMBER_SELF`) — there may be nobody left to undo it;
- **an allow-listed member** (`409 ADMIN_MEMBER_BOOTSTRAP`) — the deployment
  admits them, so the deployment is where their access changes;
- **the last active Super admin** (`409 ADMIN_MEMBER_LAST_SUPER_ADMIN`).

### `async function lockMember(tx: Tx, id: string): Promise<MemberRow>`

Every write takes one transaction-scoped advisory lock before it reads. Member
management is a handful of writes a week, so serialising it costs nothing, and
it is what makes the last-Super-admin rule hold under a race: two Super admins
disabling each other at the same instant are put in order, and the second one
finds itself the last. Row locks taken in two different orders would deadlock
instead.

### `async disable(`

Disabling revokes the member's ADMIN-scope sessions in the same transaction, so
the console or Sales workspace closes on their next click. Their row, and
everything they did, stays: audit entries, sales attribution and listing
attribution all keep resolving to a named person.

### `async activate(`

A re-activated member returns to `ACTIVE` only if they had ever signed in;
otherwise to `INVITED`, so that the first sign-in still proves the Google
address is theirs.

### `async history(`

The member's own audit entries plus their console sign-ins, newest first, capped
at fifty. Actor emails are resolved in one query rather than per row.
