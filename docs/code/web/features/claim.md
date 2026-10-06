# web / features/claim

Parent: [web](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/claim/claim-dealership/claim-dealership.tsx`

### `export function ClaimDealership({ token, preview: initial, widget }: ClaimDealershipProps)`

**R113** — the dealer's half of an assisted onboarding, on a public page. The
email is confirmed by a button, not by opening the link, so a mail scanner that
fetches the URL changes nothing. The phone step refuses, before any SMS is sent,
a number that does not end in the dealership's last four digits — the API would
refuse it anyway, but an OTP is a cost and a wrong number is the commonest
mistake.

## `apps/web/src/features/claim/claim-actions.ts`

### `export async function claimDealershipAction(`

The API sets the new dealer session on its own response; the action relays that
cookie onto the browser (`relaySessionCookie`), as phone linking does, so the
dealer lands in their console already signed in.

## `apps/web/src/app/(public)/claim/[token]/page.tsx`

`noindex` and `no-referrer`: the URL is a credential for three days, and neither
a search engine nor the next site the dealer clicks to should receive it.
