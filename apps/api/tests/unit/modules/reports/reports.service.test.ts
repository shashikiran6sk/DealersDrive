import type { VehicleReport } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createReportsService } from '../../../../src/modules/reports/reports.service.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';
import type { ChallanRecord } from '../../../../src/platform/rc/rc.port.js';

/**
 * The two projections, which are the privacy boundary for this feature.
 *
 * `toDealerDto` is itemised because a dealer has to clear the challans before
 * selling. `toPublicSummary` is aggregated because ARCHITECTURE §6.1 says full
 * records on a public page make the marketplace a free vehicle-history service
 * — the exact thing masking the registration number was meant to prevent. This
 * file is what stops the second drifting toward the first.
 */
const CHALLANS: ChallanRecord[] = [
  {
    challanRef: '4417',
    offenceDate: '2025-11-03T00:00:00.000Z',
    offence: 'Over-speeding',
    amountPaise: 100000,
    status: 'UNPAID',
    court: false,
  },
  {
    challanRef: '8820',
    offenceDate: '2025-06-19T00:00:00.000Z',
    offence: 'Over-speeding',
    amountPaise: 100000,
    status: 'UNPAID',
    court: false,
  },
  {
    challanRef: '1043',
    offenceDate: '2024-09-02T00:00:00.000Z',
    offence: 'Signal jumping',
    amountPaise: 50000,
    status: 'DISPOSED',
    court: true,
  },
];

function report(over: Partial<VehicleReport> = {}): VehicleReport {
  const unpaid = CHALLANS.filter((row) => row.status === 'UNPAID');
  return {
    id: 'rep-1',
    vehicleId: 'veh-1',
    dealerId: 'dlr-1',
    provider: 'mock',
    fetchedAt: new Date('2026-02-12T09:14:00.000Z'),
    blacklistStatus: 'CLEAR',
    blacklistReasons: [],
    nocIssuedTo: null,
    challansAvailable: true,
    challanCount: CHALLANS.length,
    challanUnpaidCount: unpaid.length,
    challanOutstandingPaise: BigInt(unpaid.reduce((sum, row) => sum + row.amountPaise, 0)),
    challans: CHALLANS as never,
    financed: false,
    rcStatus: 'ACTIVE',
    insuranceUpto: new Date('2027-03-31T00:00:00.000Z'),
    fitnessUpto: null,
    pucUpto: new Date('2026-08-14T00:00:00.000Z'),
    taxUpto: null,
    publishedAt: null,
    ...over,
  };
}

function serviceWith(
  flags: Record<string, boolean> = {},
  repo: Record<string, unknown> = {},
  rc: Record<string, unknown> = {},
) {
  const config = {
    number: (key: string) => Promise.resolve(key === 'report.freshnessHours' ? 24 : 0),
    boolean: (key: string) => Promise.resolve(flags[key] ?? key === 'feature.vehicleReport'),
  } as unknown as PlatformConfigService;

  return createReportsService({
    prisma: {} as never,
    repo: repo as never,
    rc: {
      provider: 'mock',
      lookup: () => Promise.reject(new Error('not used')),
      ...rc,
    },
    config,
  });
}

describe('the dealer projection', () => {
  it('itemises every challan, because they have to clear them', async () => {
    const dto = await serviceWith().toDealerDto(report());

    expect(dto.challanDetails).toHaveLength(3);
    expect(dto.challanDetails[0]).toMatchObject({
      challanRef: '4417',
      offence: 'Over-speeding',
      amountLabel: '₹1,000',
      status: 'UNPAID',
    });
    // The court flag is separate from unpaid: it is materially worse, and it
    // is settled differently.
    expect(dto.challanDetails[2]?.court).toBe(true);
  });

  it('carries the date and the source with the claim', async () => {
    const dto = await serviceWith().toDealerDto(report());

    expect(dto.asOfLabel).toBe('as of 12 Feb 2026');
    expect(dto.source).toContain('VAHAN');
    expect(dto.disclaimer).toContain('does not independently verify');
  });
});

describe('the public projection', () => {
  it('carries no challan references or exact offence dates', async () => {
    const summary = await serviceWith().toPublicSummary(report());
    const serialised = JSON.stringify(summary);

    // References would make the page a lookup service for anyone with a
    // scraper; exact dates identify specific enforcement events.
    for (const reference of ['4417', '8820', '1043']) {
      expect(serialised).not.toContain(reference);
    }
    expect(serialised).not.toContain('2025-11-03');
  });

  it('groups offences by type and year instead', async () => {
    const summary = await serviceWith().toPublicSummary(report());

    // Everything a buyer's decision turns on, nothing that identifies an event.
    expect(summary.challans.summary).toEqual(['Over-speeding × 2 (2025)', 'Signal jumping (2024)']);
    expect(summary.challans.unpaid).toBe(2);
    expect(summary.challans.outstandingLabel).toBe('₹2,000');
  });

  it('has no field at all for itemised records', async () => {
    // The structural guarantee, not merely the current value: a public
    // component handed the wrong object still cannot render an itemised row.
    const summary = await serviceWith().toPublicSummary(report());
    expect('challanDetails' in summary).toBe(false);
  });

  it('widens to full dates only when report.publicDetail is on', async () => {
    const detailed = await serviceWith({ 'report.publicDetail': true }).toPublicSummary(report());

    expect(detailed.challans.summary[0]).toBe('Over-speeding × 2 (03 Nov 2025, 19 Jun 2025)');
    // Even then: no references, and no names or places — those were stripped
    // at the adapter and were never stored.
    expect(JSON.stringify(detailed)).not.toContain('4417');
  });
});

describe('the verdict', () => {
  it('is CLEAR only when the records were actually readable', async () => {
    const service = serviceWith();

    const clean = await service.toPublicSummary(
      report({ challanCount: 0, challanUnpaidCount: 0, challans: [] as never }),
    );
    expect(clean.verdict).toBe('CLEAR');

    /**
     * The single most important assertion in the feature. A state whose
     * challan feed is silent must never render as a clean record — that is how
     * a buyer inherits ₹15,000 of somebody else's fines on the strength of a
     * page we published.
     */
    const silent = await service.toPublicSummary(
      report({
        challansAvailable: false,
        challanCount: 0,
        challanUnpaidCount: 0,
        challans: [] as never,
      }),
    );
    expect(silent.verdict).toBe('UNAVAILABLE');
    expect(silent.headline).not.toMatch(/no (issues|challans)/i);
    expect(silent.challans.available).toBe(false);
  });

  it('flags a blacklisted vehicle without publishing the case file', async () => {
    const summary = await serviceWith().toPublicSummary(
      report({
        blacklistStatus: 'BLACKLISTED',
        blacklistReasons: ['Reported stolen — Tamil Nadu Police, FIR 118/2025'],
      }),
    );

    expect(summary.verdict).toBe('FLAGGED');
    // The buyer learns to ask. They do not get an FIR number about a third
    // party — that stays in the dealer and moderator views.
    expect(summary.blacklistNote).toContain('Ask the dealer');
    expect(JSON.stringify(summary)).not.toContain('FIR 118/2025');
  });

  it('treats an NOC as attention rather than a flag', async () => {
    const summary = await serviceWith().toPublicSummary(
      report({ blacklistStatus: 'NOC_ISSUED', nocIssuedTo: 'Karnataka' }),
    );

    expect(summary.verdict).toBe('ATTENTION');
    expect(summary.nocNote).toContain('Karnataka');
  });

  it('does not call a car clear on the strength of the fields it could read', async () => {
    // Neither block was readable. Reporting CLEAR here because an insurance
    // date parsed would be the worst possible failure.
    const summary = await serviceWith().toPublicSummary(
      report({
        blacklistStatus: 'UNKNOWN',
        challansAvailable: false,
        challanCount: 0,
        challanUnpaidCount: 0,
        challans: [] as never,
      }),
    );
    expect(summary.verdict).toBe('UNAVAILABLE');
  });
});

describe('freshness', () => {
  it('marks a report older than the window as stale', async () => {
    const service = serviceWith();

    expect(await service.isStale(report({ fetchedAt: new Date() }))).toBe(false);
    expect(
      await service.isStale(report({ fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })),
    ).toBe(true);
  });
});

describe('the feature flag', () => {
  it('yields no public summaries at all when the report is switched off', async () => {
    const service = serviceWith({ 'feature.vehicleReport': false });
    expect(await service.publicSummaries(['veh-1'])).toEqual(new Map());
  });
});

/**
 * The flag, the batch read and the refresh.
 *
 * `feature.vehicleReport` has to be honoured at every entry point, not at one:
 * a flag that suppresses the panel but still lets a summary through onto a
 * public page has not switched the feature off, it has hidden it from the one
 * audience that could have reported the problem.
 */
describe('latest and latestDto', () => {
  it('reads the newest row', async () => {
    const service = serviceWith({}, { latestForVehicle: () => Promise.resolve(report()) });

    await expect(service.latest('veh-1')).resolves.toMatchObject({ id: 'rep-1' });
  });

  it('returns nothing at all while the feature is off', async () => {
    // Not an empty report — nothing. A zeroed report renders as "no challans
    // found", which is a claim we are not making with the feature disabled.
    const service = serviceWith(
      { 'feature.vehicleReport': false },
      { latestForVehicle: () => Promise.reject(new Error('must not be read')) },
    );

    await expect(service.latestDto('veh-1')).resolves.toBeNull();
  });

  it('answers null for a vehicle that has never been checked', async () => {
    const service = serviceWith({}, { latestForVehicle: () => Promise.resolve(null) });

    await expect(service.latestDto('veh-1')).resolves.toBeNull();
  });

  it('projects the row when there is one', async () => {
    const service = serviceWith({}, { latestForVehicle: () => Promise.resolve(report()) });

    await expect(service.latestDto('veh-1')).resolves.toMatchObject({ challanDetails: [{}, {}, {}] });
  });
});

describe('publicSummaries', () => {
  it('reads nothing while the feature is off', async () => {
    const service = serviceWith(
      { 'feature.vehicleReport': false },
      { latestForVehicles: () => Promise.reject(new Error('must not be read')) },
    );

    await expect(service.publicSummaries(['veh-1'])).resolves.toEqual(new Map());
  });

  it('summarises a page of cards in one read', async () => {
    let calls = 0;
    const service = serviceWith(
      {},
      {
        latestForVehicles: () => {
          calls += 1;
          return Promise.resolve(new Map([['veh-1', report()], ['veh-2', report({ id: 'rep-2' })]]));
        },
      },
    );

    const summaries = await service.publicSummaries(['veh-1', 'veh-2']);

    expect(calls).toBe(1);
    expect(summaries.size).toBe(2);
    // Still the public projection, one card at a time — batching must not be
    // a back door onto the itemised shape.
    expect(summaries.get('veh-1')).not.toHaveProperty('challanDetails');
  });
});

describe('fetchRecords and append', () => {
  it('hands back the provider’s records without persisting them', async () => {
    const service = serviceWith(
      {},
      {},
      { lookup: () => Promise.resolve({ specs: {}, records: { blacklistStatus: 'CLEAR' } }) },
    );

    await expect(service.fetchRecords('TN09BX1234')).resolves.toMatchObject({
      blacklistStatus: 'CLEAR',
    });
  });

  it('stamps the provider onto the row rather than trusting the caller for it', async () => {
    const appended: Record<string, unknown>[] = [];
    const service = serviceWith(
      {},
      {
        append: (_tx: unknown, input: Record<string, unknown>) => {
          appended.push(input);
          return Promise.resolve(report());
        },
      },
    );

    await service.append({} as never, {
      vehicleId: 'veh-1',
      dealerId: 'dlr-1',
      records: { challans: [] } as never,
    });

    expect(appended[0]).toMatchObject({ provider: 'mock' });
  });
});

describe('refreshIfStale', () => {
  const fresh = report({ fetchedAt: new Date() });

  it('does nothing while the feature is off', async () => {
    const service = serviceWith(
      { 'feature.vehicleReport': false },
      { latestForVehicle: () => Promise.reject(new Error('must not be read')) },
    );

    await expect(service.refreshIfStale('veh-1', 'dlr-1', 'TN09BX1234')).resolves.toBeNull();
  });

  it('keeps a report that is still fresh', async () => {
    const service = serviceWith(
      {},
      {
        latestForVehicle: () => Promise.resolve(fresh),
        append: () => Promise.reject(new Error('must not re-fetch')),
      },
    );

    await expect(service.refreshIfStale('veh-1', 'dlr-1', 'TN09BX1234')).resolves.toBe(fresh);
  });

  it('cannot refresh a vehicle with no plate, and says so by doing nothing', async () => {
    const stale = report({ fetchedAt: new Date('2020-01-01T00:00:00.000Z') });
    const service = serviceWith(
      {},
      {
        latestForVehicle: () => Promise.resolve(stale),
        append: () => Promise.reject(new Error('must not re-fetch')),
      },
    );

    await expect(service.refreshIfStale('veh-1', 'dlr-1', null)).resolves.toBe(stale);
  });

  it('re-fetches and appends when the current report has aged out', async () => {
    const appended: Record<string, unknown>[] = [];
    const service = serviceWith(
      {},
      {
        latestForVehicle: () => Promise.resolve(report({ fetchedAt: new Date('2020-01-01') })),
        append: (_tx: unknown, input: Record<string, unknown>) => {
          appended.push(input);
          return Promise.resolve(report({ id: 'rep-new' }));
        },
      },
      { lookup: () => Promise.resolve({ specs: {}, records: { challans: [] } }) },
    );

    await expect(service.refreshIfStale('veh-1', 'dlr-1', 'TN09BX1234')).resolves.toMatchObject({
      id: 'rep-new',
    });
    expect(appended).toHaveLength(1);
  });

  it('fetches for the first time when there is no report at all', async () => {
    const service = serviceWith(
      {},
      {
        latestForVehicle: () => Promise.resolve(null),
        append: () => Promise.resolve(report({ id: 'rep-first' })),
      },
      { lookup: () => Promise.resolve({ specs: {}, records: { challans: [] } }) },
    );

    await expect(service.refreshIfStale('veh-1', 'dlr-1', 'TN09BX1234')).resolves.toMatchObject({
      id: 'rep-first',
    });
  });

  it('never lets a records outage stop a dealer publishing a car', async () => {
    // This runs inside `submit()`. A stale report with an honest date is a
    // worse report but a truthful one; a failed submission is a lost listing.
    const stale = report({ fetchedAt: new Date('2020-01-01T00:00:00.000Z') });
    const service = serviceWith(
      {},
      { latestForVehicle: () => Promise.resolve(stale), append: () => Promise.resolve(report()) },
      { lookup: () => Promise.reject(new Error('provider down')) },
    );

    await expect(service.refreshIfStale('veh-1', 'dlr-1', 'TN09BX1234')).resolves.toBe(stale);
  });
});
