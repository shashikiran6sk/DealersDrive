# web / components/leads/call-lead-list

Parent: [web/components/leads](README.md)

## `apps/web/src/components/leads/call-lead-list/call-lead-list.tsx`

### `export function CallLeadList({ leads, audience, nextHref }: CallLeadListProps)`

The customers who revealed a dealership's number, most recent first. One
component for both consoles: the dealer's Customer calls page and the admin's
oversight page render the same rows, and an admin row also names the
dealership. `audience` only changes the empty state's wording.

It lives under `components/` rather than a feature folder because two features
render it. It is a server component with no state: Show more is a link to the
next cursor, as the enquiry inbox's is.

## `apps/web/src/components/leads/call-lead-list/call-lead-card.tsx`

### `export function CallLeadCard({ lead }: CallLeadCardProps)`

Laid out like an enquiry card so a dealer reads both the same way — who, which
car, when — with a Call button where the number is still on file. There are no
status buttons: a lead has no status.
