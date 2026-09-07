import { revalidateTag } from 'next/cache';

/**
 * The cache tags the public pages are built from, and the one function that
 * clears them.
 *
 * ## The problem this solves
 *
 * A dealer changed their Maps link, or their name, or their opening hours, and
 * watched their own portfolio for five to ten minutes before it caught up. Two
 * caches were stacked and neither was ever invalidated:
 *
 *   · every public `apiGet` asks for `revalidate: 600`, so Next's Data Cache
 *     holds the API's answer for ten minutes;
 *   · `/dealers/[slug]` is `export const revalidate = 600`, so the rendered
 *     page is held for ten minutes as well.
 *
 * Both are right. A directory changes at the pace of onboarding and a portfolio
 * at the pace of a dealer editing it, so time-based expiry is the wrong lever
 * to reach for — the answer is not a shorter window, which would cost every
 * anonymous visitor a round trip to make one dealer's edit land sooner. The
 * answer is to say *when* the thing has changed, which is exactly what a write
 * path knows and a timer never will.
 *
 * The API's own `Cache-Control: public, max-age=300` is a third window, and it
 * is not a factor: nothing between the Next server and the API caches — an ALB
 * does not — and no browser reaches these routes directly. It matters the day a
 * CDN is put in front of the API, and on that day this file is where the note
 * belongs.
 *
 * ## Why tags rather than `revalidatePath`
 *
 * `revalidatePath('/dealers/[slug]', 'page')` would need no slug, which is
 * tempting for the admin paths below. But the guarantee wanted here is that the
 * *fetch* is re-issued, and a tag is the mechanism that says so directly: every
 * Data Cache entry carrying the tag is dropped, and every route that rendered
 * from one is dropped with it. Reasoning about which cache a path expression
 * reaches is how a cache fix ships that does not fix anything.
 */

/**
 * Everything that lists dealerships: the directory grid, its chips, and the
 * header's district selector in the public layout.
 *
 * One tag rather than three, because the three change together. A dealership
 * being approved, suspended or renamed moves the grid, the counts beside the
 * chips and the count beside the district in one write.
 */
export const DEALERS_TAG = 'dealers';

/** One dealership's public page. */
export function dealerTag(slug: string): string {
  return `dealer:${slug}`;
}

/**
 * Every public page a change to this dealership can be seen on.
 *
 * Called from Server Actions and route handlers, never from a render. The slug
 * is optional because not every write path knows one — and the listing pages
 * are cleared either way, so the worst case is a portfolio that lags rather
 * than a directory that does.
 */
export function revalidatePublicDealer(slug?: string | null): void {
  revalidateTag(DEALERS_TAG);
  if (slug) revalidateTag(dealerTag(slug));
}
