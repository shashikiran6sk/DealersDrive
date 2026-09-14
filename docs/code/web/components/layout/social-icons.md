# web / components/layout/social-icons

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/layout/social-icons/social-icon.tsx`

### `export function SocialIcon({ network }: { network: SocialLink['network'] })`

One mark, 16×16, inheriting the anchor's colour.

`strokeWidth` is 1.6 rather than 1 because these sit at 16px beside 12–13px
text, and a hairline stroke at that size disappears against the footer's
ground on a non-retina display.

`aria-hidden` because the accessible name lives on the anchor that wraps it.

## `apps/web/src/components/layout/social-icons/social-marks.tsx`

### `export const SOCIAL_MARKS: Record<SocialLink['network'], ReactElement> =`

The six social marks, as inline SVG (**R44**). Inline rather than a library
because the alternative is a dependency for six paths, and no new dependency
is added that the baseline did not already have. They are drawn at
`currentColor` on a `0 0 24 24` box, so the footer's hover colour is the only
thing deciding how they look.
