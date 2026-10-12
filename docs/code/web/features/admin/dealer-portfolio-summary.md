# web / features/admin/dealer-portfolio-summary

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/dealer-portfolio-summary/dealer-portfolio-summary.tsx`

### `export function DealerPortfolioSummary({ photos, dealerSlug }: DealerPortfolioSummaryProps)`

The dealership's portfolio photographs, as the reviewer of one dealership needs
to see them (**#299**). It takes the place of the old "Yard photo" card, which
went when yard photographs left onboarding.

**Read-only by design, with one exception.** Approving and rejecting a pending
photograph is the portfolio queue's job (`/admin/portfolio`), where pending
photographs from every dealership are decided side by side with their
replacements; doing it here too would make two places that can disagree about a
replacement. The link to the queue is always shown for that reason.

The exception is **taking an approved photograph down**. That is the response to
something found on a live page while looking at this dealership — a number
plate, a phone number painted on a wall — and making the moderator go and find
the same photograph in a queue that only lists pending ones would be no
response at all.

## `apps/web/src/features/admin/dealer-portfolio-summary/dealer-portfolio-summary.constants.ts`

### `export const PORTFOLIO_STATUS_ADMIN_LABELS`

The contract's `statusLabel` is written for the dealer ("Approved — shown on
your page"). The admin page uses its own labels rather than printing the
dealer's second person at a moderator.

### `export const MIN_TAKE_DOWN_REASON = 6`

`ReasonInput`'s minimum, which `takeDownPortfolioPhotoAction` parses with. The
dealer reads the reason verbatim, so the button stays disabled until there is
one.

## `apps/web/src/features/admin/dealer-portfolio-summary/portfolio-tile.tsx`

### `photo.previewUrl ?`

`previewUrl` is a short-lived signed read of the private original — a pending
photograph is not public, so there is no public URL to fall back to. A missing
preview is shown as a placeholder rather than a broken image.
