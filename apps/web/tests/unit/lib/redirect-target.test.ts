import { describe, expect, it } from 'vitest';

import { redirectTargetOf } from '@/lib/redirect-target';

describe('redirectTargetOf', () => {
  it('reads where a server action redirected, and how', () => {
    expect(
      redirectTargetOf({ digest: 'NEXT_REDIRECT;push;/dealer/vehicles/abc/edit?step=basics;307;' }),
    ).toEqual({
      href: '/dealer/vehicles/abc/edit?step=basics',
      replace: false,
    });
    expect(redirectTargetOf({ digest: 'NEXT_REDIRECT;replace;/dealer;303;' })).toEqual({
      href: '/dealer',
      replace: true,
    });
  });

  it('keeps a target that itself contains a semicolon', () => {
    expect(redirectTargetOf({ digest: 'NEXT_REDIRECT;push;/a;b;307;' })?.href).toBe('/a;b');
  });

  it.each([
    null,
    undefined,
    'NEXT_REDIRECT;push;/x;307;',
    new Error('boom'),
    { digest: 'NEXT_NOT_FOUND' },
    { digest: 42 },
  ])('is null for anything that is not a redirect: %j', (error) => {
    expect(redirectTargetOf(error)).toBeNull();
  });
});
