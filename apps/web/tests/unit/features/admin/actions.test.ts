import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidations } from '../../../setup.js';
import {
  approveDealerAction,
  rejectDocumentAction,
  suspendDealerAction,
  updateDealerAction,
} from '../../../../src/features/admin/actions.js';

/**
 * The moderation actions, and the one property this file exists for: **a
 * decision that changes what the public can see clears the public pages.**
 *
 * Public visibility is `dealer.status === 'ACTIVE'` (rule 6), so a suspension
 * is the write that takes a dealership off the marketplace. Before this, the
 * only revalidation any of these performed was `/admin` — so the dealership's
 * portfolio went on being served from Next's cache for up to ten minutes after
 * it had been suspended, and its card stayed in the directory for the same. Of
 * the several stale windows this change closes, that is the one that is not
 * merely untidy.
 *
 * The console's own refresh is asserted alongside, because losing it while
 * adding the public one would trade one stale screen for another.
 */
const ORIGINAL_FETCH = globalThis.fetch;

const DEALER = '4bafe791-892d-4696-8309-ee23f172211b';
const SLUG = 'sri-lakshmi-motors-vellore-tamil-nadu';

function respond(status: number, body: unknown = {}): typeof fetch {
  const reply = {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { getSetCookie: () => [] },
  } as unknown as Response;

  return vi.fn(() => Promise.resolve(reply));
}

beforeEach(() => {
  globalThis.fetch = respond(200, { id: DEALER, status: 'ACTIVE', slug: SLUG });
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('a decision that changes public visibility', () => {
  it('clears the suspended dealership from the directory and its own page', async () => {
    const result = await suspendDealerAction(DEALER, { reason: 'Documents withdrawn.' }, SLUG);

    expect(result.ok).toBe(true);
    expect(revalidations.tags).toEqual(['dealers', `dealer:${SLUG}`]);
    expect(revalidations.paths).toContain('/admin');
  });

  it('puts an approved dealership in front of buyers at once', async () => {
    await approveDealerAction(DEALER, {}, SLUG);

    expect(revalidations.tags).toEqual(['dealers', `dealer:${SLUG}`]);
  });

  /**
   * Rejecting a document can hand a PENDING_APPROVAL application back to DRAFT,
   * and a dealership that is not ACTIVE is not public — so this reaches the
   * marketplace even though it names a document rather than a dealership.
   */
  it('clears the pages a rejected document can remove a dealership from', async () => {
    await rejectDocumentAction('doc-1', { reason: 'Too blurry to read.' }, SLUG);

    expect(revalidations.tags).toContain(`dealer:${SLUG}`);
  });

  /**
   * The one action that answers with the dealership, so it does not have to be
   * told which one it wrote.
   */
  it('takes the slug off the profile it just saved', async () => {
    globalThis.fetch = respond(200, { id: DEALER, slug: 'velavan-cars-katpadi' });

    await updateDealerAction(DEALER, { tagline: 'Now open on Sundays' });

    expect(revalidations.tags).toContain('dealer:velavan-cars-katpadi');
  });

  /**
   * A caller that forgets the slug still clears the listing pages. That is the
   * whole reason the parameter is optional: a missed call site degrades to one
   * stale portfolio rather than to a stale directory, and never to a crash.
   */
  it('still clears the directory when no slug was passed', async () => {
    await approveDealerAction(DEALER, {});

    expect(revalidations.tags).toEqual(['dealers']);
  });

  it('revalidates nothing when the decision was refused', async () => {
    globalThis.fetch = respond(409, {
      type: 'about:blank',
      title: 'Already approved',
      status: 409,
      code: 'DEALER_ALREADY_APPROVED',
    });

    const result = await suspendDealerAction(DEALER, { reason: 'Documents withdrawn.' }, SLUG);

    expect(result.ok).toBe(false);
    expect([revalidations.paths, revalidations.tags]).toEqual([[], []]);
  });
});
