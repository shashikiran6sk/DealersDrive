import { describe, expect, it, vi } from 'vitest';

import { createAttestrRcLookup } from '../../../../src/platform/rc/attestr.adapter.js';
import { RcLookupError } from '../../../../src/platform/rc/rc.port.js';

/**
 * The production RC adapter.
 *
 * Verified against Attestr's documented response shape with a stubbed `fetch`,
 * not against Attestr — this build has no account, and the first real lookup
 * should be watched. That is the same position `msg91.adapter.test.ts` is in,
 * and it is why Attestr was chosen over providers whose schema is only
 * available after a sales call: an adapter cannot be tested against prose.
 *
 * The assertion that earns this file's existence is the last block. Everything
 * else can be caught in staging; a personal field silently reaching the domain
 * cannot, because nothing downstream would fail.
 */

/** A response carrying every field Attestr documents, including all the PII. */
const FULL_RESPONSE = {
  valid: true,
  // ── the parts we want ──────────────────────────────────────────────────
  makerDescription: 'MARUTI SUZUKI INDIA LTD',
  makerModel: 'SWIFT VXI',
  makerVariant: null,
  fuelType: 'PETROL',
  colorType: 'PEARL WHITE',
  cubicCapacity: 1197,
  seatingCapacity: 5,
  normsType: 'BHARAT STAGE VI',
  ownerNumber: '2',
  manufactured: '11-Dec-2019',
  registered: '2020-01-07',
  rto: 'VELLORE',
  status: 'ACTIVE',
  blacklistStatus: false,
  blacklistDetails: [],
  financed: true,
  insuranceUpto: '31-Mar-2027',
  fitnessUpto: '2035-01-06',
  pollutionCertificateUpto: '14/08/2026',
  taxUpto: '2029-01-06',
  challanDetails: [
    {
      challanNumber: 'TN0920251103004417',
      challanDate: '03-Nov-2025',
      offence: 'Over-speeding',
      amount: 1000,
      status: 'Unpaid',
      // ── and the parts that must not survive ──────────────────────────
      name_of_violator: 'A. Kumar',
      driver_name: 'A. Kumar',
      owner_name: 'A. Kumar',
      offender_mobile_number: '9840012345',
      challan_place: 'Katpadi Main Road, Vellore',
      dl_number: 'TN2320110004417',
    },
  ],
  // ── personal data at the top level ────────────────────────────────────
  owner: 'ARUN KUMAR',
  masked: false,
  father: 'SUBRAMANIAN',
  mobile: '9840012345',
  currentAddress: '14, Gandhi Nagar, Katpadi, Vellore 632007',
  permanentAddress: '14, Gandhi Nagar, Katpadi, Vellore 632007',
  chassisNumber: 'MA3EJKD1S00123456',
  engineNumber: 'K12MN1234567',
  lender: 'HDFC BANK LTD',
  exShowroomPrice: 645000,
  insuranceProvider: 'ICICI Lombard',
  insurancePolicyNumber: 'POL/2026/0098231',
  pollutionCertificateNumber: 'PUC2026TN0918822',
};

function respondWith(body: unknown, status = 200): typeof fetch {
  return vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
}

function callOf(fetchImpl: typeof fetch): [string, RequestInit] {
  return (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
}

describe('the request', () => {
  it('posts the registration to the documented endpoint', async () => {
    const fetchImpl = respondWith(FULL_RESPONSE);
    await createAttestrRcLookup(fetchImpl).lookup('TN09BX1234');

    const [url, init] = callOf(fetchImpl);
    expect(url).toBe('https://api.attestr.com/api/v2/public/checkx/rc');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ reg: 'TN09BX1234' });
  });

  /** A URL ends up in access logs; a credential must not. */
  it('sends the token as a header, never in the URL', async () => {
    const fetchImpl = respondWith(FULL_RESPONSE);
    await createAttestrRcLookup(fetchImpl).lookup('TN09BX1234');

    const [url, init] = callOf(fetchImpl);
    expect(url).not.toMatch(/token|auth/i);
    expect(String((init.headers as Record<string, string>).Authorization)).toMatch(/^Basic /);
  });

  /** The dealer is waiting, and the manual form is one click away. */
  it('gives up rather than hanging', async () => {
    const fetchImpl = respondWith(FULL_RESPONSE);
    await createAttestrRcLookup(fetchImpl).lookup('TN09BX1234');
    expect(callOf(fetchImpl)[1].signal).toBeDefined();
  });
});

describe('reading the response', () => {
  it('maps the specs, parsing all three date formats a state might use', async () => {
    const { specs } = await createAttestrRcLookup(respondWith(FULL_RESPONSE)).lookup('TN09BX1234');

    expect(specs.makerDescription).toBe('MARUTI SUZUKI INDIA LTD');
    expect(specs.cubicCapacity).toBe(1197);
    // `2` arrives as a string from some RTOs.
    expect(specs.ownerNumber).toBe(2);
    // `11-Dec-2019`
    expect(specs.manufacturedOn).toBe('2019-12-11T00:00:00.000Z');
    // `2020-01-07`
    expect(specs.registeredOn).toBe('2020-01-07T00:00:00.000Z');
  });

  it('reads day-first for slash dates, because an RC is never month-first', async () => {
    const { records } = await createAttestrRcLookup(respondWith(FULL_RESPONSE)).lookup(
      'TN09BX1234',
    );
    // `14/08/2026` is 14 August, not 8 February.
    expect(records.pucUpto).toBe('2026-08-14T00:00:00.000Z');
  });

  it('converts challan rupees to paise', async () => {
    const { records } = await createAttestrRcLookup(respondWith(FULL_RESPONSE)).lookup(
      'TN09BX1234',
    );
    // ₹1,000 — storing 1000 here would be the money bug Rule 3 exists for.
    expect(records.challans[0]?.amountPaise).toBe(100000);
  });

  it('keeps only the last four of a challan number', async () => {
    const { records } = await createAttestrRcLookup(respondWith(FULL_RESPONSE)).lookup(
      'TN09BX1234',
    );
    // Enough to find it on the government portal, useless for enumeration.
    expect(records.challans[0]?.challanRef).toBe('4417');
  });

  /**
   * The distinction the whole report rests on. `null` from the provider means
   * the state's feed said nothing; an empty array means it answered "none".
   */
  it('separates an absent challan feed from an empty one', async () => {
    const silent = await createAttestrRcLookup(
      respondWith({ ...FULL_RESPONSE, challanDetails: null }),
    ).lookup('TN09BX1234');
    expect(silent.records.challansAvailable).toBe(false);

    const none = await createAttestrRcLookup(
      respondWith({ ...FULL_RESPONSE, challanDetails: [] }),
    ).lookup('TN09BX1234');
    expect(none.records.challansAvailable).toBe(true);
    expect(none.records.challans).toEqual([]);
  });

  /** UNKNOWN is not CLEAR — see the note on `RcRecords.blacklistStatus`. */
  it('never reads an unreadable blacklist block as clear', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({
        ...FULL_RESPONSE,
        blacklistStatus: undefined,
        blacklistDetails: undefined,
        status: undefined,
      }),
    ).lookup('TN09BX1234');

    expect(records.blacklistStatus).toBe('UNKNOWN');
  });

  it('flags a blacklisted vehicle and keeps the reason', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({
        ...FULL_RESPONSE,
        blacklistStatus: true,
        blacklistDetails: [{ reason: 'Reported stolen' }],
      }),
    ).lookup('TN09BX1234');

    expect(records.blacklistStatus).toBe('BLACKLISTED');
    expect(records.blacklistReasons).toEqual(['Reported stolen']);
  });

  it('treats an unreadable field as missing rather than losing the report', async () => {
    const { specs, records } = await createAttestrRcLookup(
      respondWith({ ...FULL_RESPONSE, insuranceUpto: 'NA', cubicCapacity: 'not a number' }),
    ).lookup('TN09BX1234');

    expect(records.insuranceUpto).toBeNull();
    expect(specs.cubicCapacity).toBeNull();
    // The rest survived — a dealer who cannot see an insurance date should
    // still see the blacklist status.
    expect(specs.makerDescription).toBe('MARUTI SUZUKI INDIA LTD');
  });
});

/**
 * The alternate spellings, and the empty response.
 *
 * A provider's field names are not one set: `offence` / `offenceDetails` /
 * `violation` and `challanNumber` / `challanNo` all appear across states, and
 * an adapter that reads only the first spelling drops the challan silently —
 * which is the failure mode this whole feature exists to avoid, arriving as a
 * clean report rather than as an error.
 */
describe('a response with nothing in it', () => {
  it('produces a fully null record rather than throwing', async () => {
    const { specs, records } = await createAttestrRcLookup(respondWith({})).lookup('TN09BX1234');

    expect(specs).toMatchObject({
      makerDescription: null,
      makerModel: null,
      cubicCapacity: null,
      seatingCapacity: null,
      ownerNumber: null,
      manufacturedOn: null,
      rtoName: null,
    });
    expect(records).toMatchObject({
      rcStatus: null,
      // Not CLEAR. There was neither a flag nor a status to read, and a
      // provider outage rendering as a clean bill of health on a stolen car is
      // the worst thing this feature can produce.
      blacklistStatus: 'UNKNOWN',
      blacklistReasons: [],
      nocIssuedTo: null,
      // No challan array at all means the feed said nothing, which is not the
      // same as it saying "none".
      challansAvailable: false,
      challans: [],
      financed: null,
      insuranceUpto: null,
    });
  });

  it('reads an empty challan array as "we asked and there are none"', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({ ...FULL_RESPONSE, challanDetails: [] }),
    ).lookup('TN09BX1234');

    expect(records.challansAvailable).toBe(true);
    expect(records.challans).toEqual([]);
  });
});

describe('the spellings a state might use', () => {
  it('reads a challan written with every alternate field name', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({
        ...FULL_RESPONSE,
        challanDetails: [
          { violation: 'Signal jumping', fineImposed: 500, challanNo: 'TN0912345678', challanStatus: 'Pending' },
        ],
      }),
    ).lookup('TN09BX1234');

    expect(records.challans[0]).toMatchObject({
      offence: 'Signal jumping',
      // Rupees in, paise out. Rule 3 applies to a fine as much as to a price.
      amountPaise: 50_000,
      // Last four only — enough to find it on the portal, useless for
      // enumerating anyone else's.
      challanRef: '5678',
      status: 'UNPAID',
    });
  });

  it('falls back to a generic offence rather than dropping the challan', async () => {
    // An unnamed offence is still an outstanding fine the buyer inherits.
    const { records } = await createAttestrRcLookup(
      respondWith({ ...FULL_RESPONSE, challanDetails: [{ amount: 100 }] }),
    ).lookup('TN09BX1234');

    expect(records.challans[0]).toMatchObject({
      offence: 'Traffic violation',
      amountPaise: 10_000,
      challanRef: '',
      offenceDate: null,
    });
  });

  it('reads an unknown challan status as unpaid, never as settled', async () => {
    // Understating an outstanding fine is the error that costs a buyer money.
    const { records } = await createAttestrRcLookup(
      respondWith({ ...FULL_RESPONSE, challanDetails: [{ offence: 'X', status: 'ambiguous' }] }),
    ).lookup('TN09BX1234');

    expect(records.challans[0]?.status).toBe('UNPAID');
  });

  it('separates a court referral from a plain unpaid fine', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({
        ...FULL_RESPONSE,
        challanDetails: [{ offence: 'X', status: 'Referred to Court' }],
      }),
    ).lookup('TN09BX1234');

    expect(records.challans[0]).toMatchObject({ status: 'DISPOSED', court: true });
  });

  it('drops a challan entry that is not an object at all', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({ ...FULL_RESPONSE, challanDetails: [null, 'nonsense', { offence: 'Real' }] }),
    ).lookup('TN09BX1234');

    expect(records.challans).toHaveLength(1);
    // Still `available: true`: the feed answered, it just answered badly.
    expect(records.challansAvailable).toBe(true);
  });

  it('reads blacklist reasons written as plain strings or as rows', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({
        ...FULL_RESPONSE,
        blacklistDetails: ['Reported stolen', { remarks: 'Tax default' }, { type: 'Seized' }, 42],
      }),
    ).lookup('TN09BX1234');

    expect(records.blacklistReasons).toEqual(['Reported stolen', 'Tax default', 'Seized']);
    // Any reason at all is enough: a listed reason means blacklisted.
    expect(records.blacklistStatus).toBe('BLACKLISTED');
  });

  it('reads an NOC out of the RC status when no flag is set', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({ status: 'NOC ISSUED' }),
    ).lookup('TN09BX1234');

    expect(records.blacklistStatus).toBe('NOC_ISSUED');
  });

  it('trusts an explicit false flag', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({ status: 'ACTIVE', blacklistStatus: false }),
    ).lookup('TN09BX1234');

    expect(records.blacklistStatus).toBe('CLEAR');
  });
});

describe('impossible dates', () => {
  /**
   * `31-02-2027` parses field by field and then is not a date. It must become
   * null, not `Invalid Date` — a NaN date reaching Postgres is a 500 on a page
   * that rendered fine yesterday, and one bad field must only cost that field.
   */
  it('drops a date that does not exist rather than producing Invalid Date', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({ ...FULL_RESPONSE, insuranceUpto: '31-02-99999', pucUpto: '2026-08-14' }),
    ).lookup('TN09BX1234');

    expect(records.insuranceUpto).toBeNull();
    // The neighbouring field is untouched: degrade the field, not the report.
    expect(records.pucUpto).toBe('2026-08-14T00:00:00.000Z');
  });
});

describe('the NOC field', () => {
  /**
   * A state, never a person. `nocDetails` in a raw response also carries the
   * name and address of whoever the certificate was issued to; only the
   * destination state survives, because the destination is the part that
   * changes what a buyer is taking on.
   */
  it('reads the destination state', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({ ...FULL_RESPONSE, nocDetails: { state: 'Karnataka', holder: 'ARUN KUMAR' } }),
    ).lookup('TN09BX1234');

    expect(records.nocIssuedTo).toBe('Karnataka');
  });

  it('falls back through the spellings a state might use for it', async () => {
    const { records } = await createAttestrRcLookup(
      respondWith({ ...FULL_RESPONSE, nocDetails: { toRto: 'KA-01' } }),
    ).lookup('TN09BX1234');

    expect(records.nocIssuedTo).toBe('KA-01');
  });

  it('reads nothing rather than guessing when the shape is not an object', async () => {
    for (const shape of [null, 'Karnataka', 42, undefined]) {
      const { records } = await createAttestrRcLookup(
        respondWith({ ...FULL_RESPONSE, nocDetails: shape }),
      ).lookup('TN09BX1234');

      expect(records.nocIssuedTo).toBeNull();
    }
  });
});

describe('failures', () => {
  it('reads a valid:false body as NOT_FOUND', async () => {
    const lookup = createAttestrRcLookup(
      respondWith({ valid: false, message: 'No record found' }),
    ).lookup('TN09BX1234');

    await expect(lookup).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });

  /**
   * Our exhausted credits and our un-whitelisted IP are our problems. They
   * must never reach a dealer as "there is something wrong with your vehicle".
   */
  it.each([
    ['4005', 'insufficient credits'],
    ['4016', 'bad credentials'],
    ['4039', 'IP not whitelisted'],
  ])('treats %s (%s) as our misconfiguration', async (code) => {
    const lookup = createAttestrRcLookup(respondWith({ code: Number(code) }, 403)).lookup(
      'TN09BX1234',
    );

    await expect(lookup).rejects.toMatchObject({ kind: 'MISCONFIGURED' });
  });

  it('distinguishes the provider rate-limiting us', async () => {
    const lookup = createAttestrRcLookup(respondWith({ code: 4291 }, 429)).lookup('TN09BX1234');
    await expect(lookup).rejects.toMatchObject({ kind: 'RATE_LIMITED' });
  });

  it('treats a malformed request as our deploy problem, not the dealer’s plate', async () => {
    // The plate was validated before it was sent, so a 400 means our request
    // shape drifted from theirs. It is logged at error and shown as generic
    // unavailability, which is what puts the dealer on the manual form rather
    // than retyping a number that was correct.
    const lookup = createAttestrRcLookup(respondWith({ code: 4001 }, 400)).lookup('TN09BX1234');

    await expect(lookup).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
  });

  it('falls back to UNAVAILABLE for a status it has never seen', async () => {
    const lookup = createAttestrRcLookup(respondWith({}, 503)).lookup('TN09BX1234');

    await expect(lookup).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
  });

  it('survives an error body that is not JSON at all', async () => {
    // A gateway returning an HTML error page is the commonest shape of a
    // provider outage, and parsing it must not turn into a different bug.
    const html = vi.fn(() =>
      Promise.resolve(new Response('<html>502 Bad Gateway</html>', { status: 502 })),
    ) as unknown as typeof fetch;

    await expect(createAttestrRcLookup(html).lookup('TN09BX1234')).rejects.toMatchObject({
      kind: 'UNAVAILABLE',
    });
  });

  it('turns a network failure into UNAVAILABLE, not a crash', async () => {
    const failing = vi.fn(() =>
      Promise.reject(new Error('ECONNREFUSED')),
    ) as unknown as typeof fetch;
    const lookup = createAttestrRcLookup(failing).lookup('TN09BX1234');

    await expect(lookup).rejects.toBeInstanceOf(RcLookupError);
    await expect(lookup).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
  });
});

/**
 * ── The assertion this file exists for ───────────────────────────────────
 *
 * A full RC response carries the registered owner's name, their father's name,
 * both addresses, a mobile number, the chassis and engine numbers, the
 * financier, and a named person on every challan. None of it is needed to list
 * or buy a car, and all of it is a liability under the DPDP Act.
 *
 * The adapter drops it *before constructing* the domain objects, so it never
 * enters the domain, never reaches a log line, and cannot be persisted by a
 * later feature whose author did not know to exclude it. This test walks the
 * whole returned object and fails if any of it survived — including inside the
 * challan array, which is the place a future refactor is most likely to spread
 * a provider row wholesale.
 */
describe('personal data', () => {
  const FORBIDDEN = [
    'ARUN KUMAR',
    'A. Kumar',
    'SUBRAMANIAN',
    '9840012345',
    'Gandhi Nagar',
    'Katpadi Main Road',
    'MA3EJKD1S00123456',
    'K12MN1234567',
    'HDFC BANK LTD',
    'TN2320110004417',
    'POL/2026/0098231',
  ];

  it('survives nowhere in the returned object', async () => {
    const result = await createAttestrRcLookup(respondWith(FULL_RESPONSE)).lookup('TN09BX1234');
    const serialised = JSON.stringify(result);

    for (const secret of FORBIDDEN) {
      expect(serialised).not.toContain(secret);
    }
  });

  it('keeps the facts that replaced it', async () => {
    // The point is not that data was lost — it is that the buyer-relevant
    // signal survives without the person attached.
    const { records } = await createAttestrRcLookup(respondWith(FULL_RESPONSE)).lookup(
      'TN09BX1234',
    );

    expect(records.challans[0]).toMatchObject({
      offence: 'Over-speeding',
      amountPaise: 100000,
      status: 'UNPAID',
    });
    // "Is there a loan on this car" is a fact about the car; who lent the
    // money is the owner's banking relationship.
    expect(records.financed).toBe(true);
  });
});
