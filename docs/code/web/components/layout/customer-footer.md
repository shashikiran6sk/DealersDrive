# web / components/layout/customer-footer

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/layout/customer-footer/customer-footer.constants.ts`

### `export const BUYER_LINKS: FooterLink[] = [`

The buyer sections, in the header's order. One list rather than three JSX
blocks, so "does the footer agree with the header" is a question somebody can
answer by reading eight lines.

### `export const DEALER_LINKS: FooterLink[] = [{ href: '/dealer', label: 'Dealer login' }]`

One door, and it is `/dealer` (**R35**). The console decides between "sign in"
and "finish onboarding" from the session, so neither header nor footer has to
guess which a visitor needs — and therefore neither can get it wrong.

## `apps/web/src/components/layout/customer-footer/customer-footer.tsx`

### `export function CustomerFooter({ social, supportEmail, supportPhone }: CustomerFooterProps)`

The buyer footer (**R44**).

The baseline's was one row — a wordmark, the trust sentence and four links
floated right — which is the right footer for a product with four pages and
the wrong one for a product a buyer is asked to hand a phone number to: there
was nowhere to find out how to reach a person. It is still a **server**
component shipping no JavaScript (invariant 8).

**It offers exactly the destinations `CustomerHeader` offers, and nothing it
invents.** Two of them — `/cars` (**F077**) and `/saved` (**F087**) — have not
landed, and the header carries them anyway; a footer that quietly disagreed
with the header would be the more confusing state. It does not invent an
About or a Terms page to fill a column out: a footer link onto a 404 is the
product telling a buyer a page exists and then not having it.

The social links come from `platform_config` via `GET /v1/config/public`, not
from code and not from a `NEXT_PUBLIC_*` variable — an account is opened,
renamed and closed on a marketing timescale, and correcting a dead link should
not need a deploy. The API drops any value that is not an `https:` URL, so a
mistyped key renders as a missing icon rather than a link into nowhere.

### `<div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-9 px-6 py-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] l`

Explicit tracks rather than `auto-fit`: the brand column has to be the
wide one, and a span inside an `auto-fit` grid either overflows at one
column or leaves a dead track at six.

### `{supportEmail ?`

An address and a number rather than a contact page, because both are
true today and a contact form is a route nobody has built. Each is
absent rather than blank when the API could not be reached.

## `apps/web/src/components/layout/customer-footer/customer-footer.types.ts`

### `export interface CustomerFooterProps`

Only what the footer renders, rather than the whole `PublicConfig`. The
payload carries eleven fields and this component reads three; taking the whole
thing would make every sandbox scenario construct eight values with no effect
on the output.

An empty string is "we do not have one" for both contacts — what
`NO_PUBLIC_CONFIG` degrades to when the API is unreachable — and the row is
then absent rather than rendered blank.

## `apps/web/src/components/layout/customer-footer/footer-column.tsx`

### `export function FooterColumn({ title, children }: { title: string; children: ReactNode })`

One column: a heading and a list. Each is its own labelled `<nav>`, named by
the heading a sighted reader sees — one landmark called "Footer" wrapping
everything hands a screen-reader user a single undifferentiated list of every
destination on the page, which is the thing a footer's columns exist to avoid.

## `apps/web/src/components/layout/customer-footer/social-row.tsx`

### `export function SocialRow({ links }: { links: PublicConfig['social'] })`

The social row, or nothing at all — and nothing at all is the important half:
a fresh deployment has published no accounts, and a row of icons linking to a
platform's own homepage, which is what a hard-coded default would be, is worse
than an absent row.

`rel="noreferrer"` as well as `noopener`: these are the only outbound links on
a buyer page, and the referring URL can carry a search a buyer ran.
