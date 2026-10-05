import { describe, expect, it } from 'vitest';

import { AUTH_HINT_SCRIPT, authHintFrom } from '@/lib/auth-hint';

/**
 * The readable `dd_auth` hint decides what the header draws before the account
 * lookup answers. It says nothing about who is signed in — only whether the
 * last answer this browser saw was "signed in" — so a missing or unreadable
 * hint must read as unknown, never as signed out.
 */
describe('authHintFrom', () => {
  it.each([
    ['dd_auth=1', 'in'],
    ['other=x; dd_auth=0', 'out'],
    ['a=1;dd_auth=1;b=2', 'in'],
    ['', 'unknown'],
    ['dd_auth=', 'unknown'],
    ['dd_auth=yes', 'unknown'],
    ['not_dd_auth=1', 'unknown'],
  ])('reads %j as %s', (header, expected) => {
    expect(authHintFrom(header)).toBe(expected);
  });
});

describe('AUTH_HINT_SCRIPT', () => {
  function run(cookie: string | null): string | null {
    document.cookie = 'dd_auth=; Path=/; Max-Age=0';
    if (cookie) document.cookie = `${cookie}; Path=/`;
    document.documentElement.removeAttribute('data-auth');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- the script is a string by design: the browser runs it before React exists, and so does this test
    new Function(AUTH_HINT_SCRIPT)();
    return document.documentElement.getAttribute('data-auth');
  }

  it('marks the page signed in, signed out or unknown before React paints anything', () => {
    expect(run('dd_auth=1')).toBe('in');
    expect(run('dd_auth=0')).toBe('out');
    expect(run(null)).toBe('unknown');
  });
});
