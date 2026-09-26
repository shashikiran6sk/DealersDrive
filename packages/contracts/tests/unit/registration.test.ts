import { describe, expect, it } from 'vitest';

import {
  REGISTRATION_MESSAGES,
  RegistrationNumber,
  STATE_CODES,
  formatRegistration,
  normaliseRegistration,
  parseRegistration,
} from '../../src/registration.js';

function read(raw: string) {
  const result = parseRegistration(raw);
  if (!result.ok) throw new Error(`expected ${raw} to parse: ${result.message}`);
  return result.value;
}

function refusal(raw: string): string {
  const result = parseRegistration(raw);
  if (result.ok) throw new Error(`expected ${raw} to be refused`);
  return result.message;
}

describe('the same plate, however it was typed', () => {
  it.each(['KA 01 AB 1234', 'KA-01-AB-1234', 'ka01ab1234', ' KA01 AB1234 ', 'KA.01.AB.1234'])(
    '%s is KA01AB1234',
    (raw) => {
      expect(read(raw)).toEqual({
        kind: 'STATE',
        canonical: 'KA01AB1234',
        display: 'KA 01 AB 1234',
        rtoCode: 'KA01',
      });
    },
  );

  it('pads the RTO number and the plate number, so one car has one form', () => {
    expect(normaliseRegistration('KA 1 AB 1')).toBe('KA01AB0001');
    expect(normaliseRegistration('KA 01 AB 0001')).toBe('KA01AB0001');
  });
});

describe('the shapes India issues', () => {
  it('reads a one- and a three-letter series', () => {
    expect(read('TN 09 B 1234').canonical).toBe('TN09B1234');
    expect(read('DL 3 CAB 1234').canonical).toBe('DL03CAB1234');
  });

  it('joins a series split by a space — DL 3C AB is series CAB', () => {
    expect(read('DL 3C AB 1234')).toMatchObject({
      canonical: 'DL03CAB1234',
      display: 'DL 03 CAB 1234',
      rtoCode: 'DL03',
    });
  });

  it('reads a plate with no series letters', () => {
    expect(read('TN 09 1234')).toMatchObject({ canonical: 'TN091234', display: 'TN 09 1234' });
  });

  it('uses the separators a dealer typed to tell the RTO from the number', () => {
    expect(read('KA 1 123').canonical).toBe('KA010123');
  });

  it('gives the RTO two digits when nothing separates it from the number', () => {
    expect(read('KA1123')).toMatchObject({ canonical: 'KA110023', rtoCode: 'KA11' });
  });

  it('reads the Bharat series, which belongs to no RTO', () => {
    expect(read('22 BH 1234 AA')).toEqual({
      kind: 'BH',
      canonical: '22BH1234AA',
      display: '22 BH 1234 AA',
      rtoCode: null,
    });
    expect(read('22bh1234a').canonical).toBe('22BH1234A');
  });

  it('reads a legacy three-letter series', () => {
    expect(read('MDU 1234')).toEqual({
      kind: 'LEGACY',
      canonical: 'MDU1234',
      display: 'MDU 1234',
      rtoCode: null,
    });
  });

  it('knows every state and union-territory code it lists', () => {
    for (const code of STATE_CODES) {
      expect(read(`${code} 01 AB 1234`).rtoCode).toBe(`${code}01`);
    }
  });
});

describe('what it refuses, and what it says', () => {
  it('asks for a value when there is none', () => {
    expect(refusal('   ')).toBe(REGISTRATION_MESSAGES.empty);
  });

  it('refuses characters no plate carries', () => {
    expect(refusal('KA01AB12#4')).toBe(REGISTRATION_MESSAGES.characters);
  });

  it('names an unknown state code', () => {
    expect(refusal('ZZ 01 AB 1234')).toBe(REGISTRATION_MESSAGES.state);
  });

  it('refuses an all-zero plate number', () => {
    expect(refusal('KA 01 AB 0000')).toBe(REGISTRATION_MESSAGES.zero);
    expect(refusal('22 BH 0000 AA')).toBe(REGISTRATION_MESSAGES.zero);
  });

  it.each([
    ['a five-digit number', 'KA 01 AB 12345'],
    ['a four-letter series', 'KA 01 ABCD 1234'],
    ['a three-digit RTO', 'KA 123 AB 1234'],
    ['a number with no state', '01 AB 1234'],
    ['a state and nothing else', 'KA'],
    ['a state and a short number', 'KA 12'],
    ['a malformed BH number', '22 BH 123 AA'],
    ['BH with a three-letter tail', '22 BH 1234 AAA'],
    ['letters where the number should be', 'KA 01 AB CD'],
    ['a legacy series with a long number', 'MDU 12345'],
  ])('refuses %s', (_label, raw) => {
    expect(parseRegistration(raw).ok).toBe(false);
  });
});

describe('formatRegistration', () => {
  it('formats a stored value for a person', () => {
    expect(formatRegistration('KA01AB1234')).toBe('KA 01 AB 1234');
  });

  it('leaves a value it cannot read exactly as stored', () => {
    expect(formatRegistration('NOT A PLATE')).toBe('NOT A PLATE');
  });
});

describe('RegistrationNumber', () => {
  it('parses to the canonical form', () => {
    expect(RegistrationNumber.parse('tn-09-bx-1234')).toBe('TN09BX1234');
  });

  it('carries the reason a value was refused', () => {
    const result = RegistrationNumber.safeParse('ZZ 01 AB 1234');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(REGISTRATION_MESSAGES.state);
  });

  it('refuses an absurdly long value before reading it', () => {
    expect(RegistrationNumber.safeParse('KA'.repeat(20)).success).toBe(false);
  });
});
