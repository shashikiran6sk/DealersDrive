import { describe, expect, it } from 'vitest';

import {
  CustomerName,
  CustomerSignUpInput,
  dealerSessionNext,
  PhoneSignInInput,
} from '../../src/auth.js';
import { DealerStatus } from '../../src/enums.js';

/**
 * Where a dealer lands after signing in (**R60**). One function answers for
 * Google, the phone and `GET /v1/auth/me`, so it is pinned for every status the
 * enum has — a status added later fails here until somebody decides where it
 * goes, rather than silently falling through to the dashboard.
 */
describe('dealerSessionNext', () => {
  const expected: Record<DealerStatus, string> = {
    DRAFT: 'ONBOARDING',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    ACTIVE: 'DASHBOARD',
    SUSPENDED: 'DASHBOARD',
    REJECTED: 'DASHBOARD',
    CLOSED: 'DASHBOARD',
  };

  it.each(DealerStatus.options)('sends %s where it always went', (status) => {
    expect(dealerSessionNext(status)).toBe(expected[status]);
  });

  it('sends somebody with no dealership yet to onboarding', () => {
    expect(dealerSessionNext(null)).toBe('ONBOARDING');
  });
});

describe('PhoneSignInInput', () => {
  it('takes a number, a token and an optional path', () => {
    expect(
      PhoneSignInInput.parse({ phone: '98400 12345', accessToken: ' t ', returnTo: '/dealer' }),
    ).toEqual({ phone: '98400 12345', accessToken: 't', returnTo: '/dealer' });
  });

  /** Nothing in the body names an account (rule 1). */
  it.each(['dealerId', 'userId', 'verified'])('refuses %s by name', (field) => {
    const result = PhoneSignInInput.safeParse({
      phone: '9840012345',
      accessToken: 't',
      [field]: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('refuses a landline', () => {
    expect(PhoneSignInInput.safeParse({ phone: '0416224889', accessToken: 't' }).success).toBe(
      false,
    );
  });
});

/**
 * The one thing a customer is asked (**R62**). Any script, one field, and
 * nothing that could render as blank or break a line on a dealer's screen.
 */
describe('CustomerName', () => {
  it.each(['Ravi', 'ಶಶಿಕಿರಣ್', 'Nguyễn Thị Anh', "D'Souza", 'Mary-Jane O Neil'])(
    'accepts %j',
    (name) => {
      expect(CustomerName.parse(name)).toBe(name);
    },
  );

  it('trims what surrounds the name', () => {
    expect(CustomerName.parse('  Ravi  ')).toBe('Ravi');
  });

  it.each(['', '   ', 'R', '1234', '---', 'x'.repeat(81), 'Ravi\nKumar', 'Ra\u0000vi'])(
    'refuses %j',
    (name) => {
      expect(CustomerName.safeParse(name).success).toBe(false);
    },
  );
});

describe('CustomerSignUpInput', () => {
  it.each(['phone', 'email', 'password'])('refuses %s by name', (field) => {
    expect(
      CustomerSignUpInput.safeParse({ signUpToken: 't', fullName: 'Ravi', [field]: 'x' }).success,
    ).toBe(false);
  });
});
