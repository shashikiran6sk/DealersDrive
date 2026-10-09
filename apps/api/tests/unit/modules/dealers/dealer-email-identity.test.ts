import { describe, expect, it } from 'vitest';

import {
  DEALER_EMAIL_TAKEN,
  normaliseDealerEmail,
  withDealerEmailConflict,
} from '../../../../src/modules/dealers/dealer-email-identity.js';

describe('primary dealer email identity', () => {
  it('normalizes case and outside whitespace without changing mailbox identity', () => {
    expect(normaliseDealerEmail('  Dealer.Name+yard@Example.TEST ')).toBe(
      'dealer.name+yard@example.test',
    );
    expect(normaliseDealerEmail('dealer.name@gmail.com')).not.toBe(
      normaliseDealerEmail('dealername@gmail.com'),
    );
  });

  it('returns a successful operation without changing its result', async () => {
    const result = { id: 'created' };
    expect(await withDealerEmailConflict(async () => result)).toBe(result);
  });

  it.each([
    { target: ['primaryOwnerEmail'] },
    { driverAdapterError: { cause: { constraint: { fields: ['primaryOwnerEmail'] } } } },
  ])('translates a primary email database conflict into useful field feedback', async (meta) => {
    await expect(
      withDealerEmailConflict(async () => {
        throw Object.assign(new Error('Unique constraint'), { code: 'P2002', meta });
      }),
    ).rejects.toMatchObject({
      code: 'DEALER_EMAIL_TAKEN',
      detail: DEALER_EMAIL_TAKEN,
      errors: [{ field: 'body.email', code: 'DEALER_EMAIL_TAKEN', message: DEALER_EMAIL_TAKEN }],
    });
  });

  it('uses the nested profile field for administrative edits', async () => {
    await expect(
      withDealerEmailConflict(async () => {
        throw Object.assign(new Error('Unique constraint'), {
          code: 'P2002',
          meta: { target: ['primaryOwnerEmail'] },
        });
      }, 'body.contact.email'),
    ).rejects.toMatchObject({ errors: [{ field: 'body.contact.email' }] });
  });

  it.each([
    Object.assign(new Error('Other constraint'), { code: 'P2002', meta: { target: ['pan'] } }),
    Object.assign(new Error('Missing metadata'), { code: 'P2002' }),
    new Error('provider failure'),
  ])('preserves unrelated failures', async (error) => {
    await expect(
      withDealerEmailConflict(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });
});
