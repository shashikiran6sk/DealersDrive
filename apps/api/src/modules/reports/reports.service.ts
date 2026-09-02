import {
  BLACKLIST_LABELS,
  BLACKLIST_TONES,
  CHALLAN_STATUS_LABELS,
  formatDate,
  formatMonthYear,
  formatRupees,
  REPORT_VERDICT_LABELS,
  REPORT_VERDICT_TONES,
  type ChallanDto,
  type ReportVerdict,
  type StatusTone,
  type VehicleReportDto,
  type VehicleReportSummary,
} from '@dealers-drive/contracts';
import type { Prisma, PrismaClient, VehicleReport } from '@prisma/client';

import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import type { ChallanRecord, RcLookupPort, RcRecords } from '../../platform/rc/rc.port.js';
import { logger } from '../../platform/telemetry/logger.js';
import type { ReportsRepository } from './reports.repository.js';

/**
 * The vehicle records report (ARCHITECTURE §6.3).
 *
 * ## Two projections, one file
 *
 * `toDealerDto` is itemised; `toPublicSummary` is aggregated. The boundary
 * between them is the privacy boundary for this whole feature, and it lives in
 * one file on purpose so it can be reviewed as a single decision rather than
 * discovered across four components.
 *
 * The public projection is narrower for the reason ARCHITECTURE §6.1 already
 * gives for hiding the registration number: full records on a public page make
 * the marketplace a free vehicle-history service, and it would be scraped in
 * bulk by exactly the people that decision was written to keep out. Aggregates
 * plus offence types carry the entire trust signal a buyer needs while being
 * worthless a million rows at a time.
 *
 * `report.publicDetail` widens it. That is a deliberate product decision with a
 * config flip behind it, not something a rendering change can do by accident.
 *
 * ## Every published string is built here
 *
 * `headline`, `asOfLabel`, `source` and `disclaimer` are composed in this
 * service and travel in the DTO. A component cannot render the claim without
 * its date and its source, and cannot rephrase it. The difference between "no
 * challans found in government records as of 12 Feb" and "this car has no
 * challans" is the difference between a report and a warranty, and it should
 * not be one component author's phrasing choice.
 */
export interface ReportsDeps {
  prisma: PrismaClient;
  repo: ReportsRepository;
  rc: RcLookupPort;
  config: PlatformConfigService;
}

const SOURCE = 'Government of India (VAHAN), via our records partner';

const DISCLAIMER =
  'These records come from government sources and can lag behind reality. ' +
  'Dealers-Drive does not independently verify them.';

export function createReportsService({ prisma, repo, rc, config }: ReportsDeps) {
  /** True once the row is older than `report.freshnessHours`. */
  async function isStale(report: VehicleReport): Promise<boolean> {
    const hours = await config.number('report.freshnessHours');
    return Date.now() - report.fetchedAt.getTime() > hours * 60 * 60 * 1000;
  }

  /**
   * The one-word answer at the top.
   *
   * `UNAVAILABLE` outranks everything: if we could not read the blacklist
   * block, we do not get to call the car clear on the strength of the fields
   * we *could* read.
   */
  function verdictOf(report: VehicleReport): ReportVerdict {
    if (report.blacklistStatus === 'BLACKLISTED') return 'FLAGGED';
    if (report.blacklistStatus === 'UNKNOWN' && !report.challansAvailable) return 'UNAVAILABLE';
    if (report.blacklistStatus === 'NOC_ISSUED') return 'ATTENTION';
    if (report.challanUnpaidCount > 0) return 'ATTENTION';
    if (!report.challansAvailable) return 'UNAVAILABLE';
    return 'CLEAR';
  }

  function headlineOf(report: VehicleReport, verdict: ReportVerdict): string {
    switch (verdict) {
      case 'FLAGGED':
        return 'Government records flag this vehicle';
      case 'ATTENTION':
        if (report.blacklistStatus === 'NOC_ISSUED') {
          return 'An NOC has been issued — this vehicle is mid-transfer';
        }
        return `${report.challanUnpaidCount} unpaid ${
          report.challanUnpaidCount === 1 ? 'challan' : 'challans'
        } on record`;
      case 'UNAVAILABLE':
        // Never "no challans". An absent feed is not a clean record, and this
        // line is the single most important string in the feature.
        return 'Some government records could not be read';
      case 'CLEAR':
      default:
        return 'No issues found in government records';
    }
  }

  function challanRows(report: VehicleReport): ChallanRecord[] {
    return Array.isArray(report.challans) ? (report.challans as unknown as ChallanRecord[]) : [];
  }

  function validityRows(
    report: VehicleReport,
  ): { label: string; value: string; tone: StatusTone }[] {
    const rows: { label: string; value: string; tone: StatusTone }[] = [];
    const add = (label: string, value: Date | null) => {
      if (!value) return;
      // Expiry is the point of showing these at all — an insurance date in the
      // past is a cost the buyer inherits on day one.
      rows.push({
        label,
        value: formatMonthYear(value),
        tone: value.getTime() < Date.now() ? 'err' : 'ok',
      });
    };
    add('Insurance', report.insuranceUpto);
    add('Pollution certificate', report.pucUpto);
    add('Fitness', report.fitnessUpto);
    add('Road tax', report.taxUpto);
    return rows;
  }

  // ── the dealer projection ───────────────────────────────────────────────
  async function toDealerDto(report: VehicleReport): Promise<VehicleReportDto> {
    const verdict = verdictOf(report);
    const rows = challanRows(report);

    return {
      verdict,
      verdictLabel: REPORT_VERDICT_LABELS[verdict],
      verdictTone: REPORT_VERDICT_TONES[verdict],
      headline: headlineOf(report, verdict),
      asOf: report.fetchedAt.toISOString(),
      asOfLabel: `as of ${formatDate(report.fetchedAt)}`,
      stale: await isStale(report),
      source: SOURCE,
      disclaimer: DISCLAIMER,
      blacklistStatus: report.blacklistStatus,
      blacklistLabel: BLACKLIST_LABELS[report.blacklistStatus],
      blacklistTone: BLACKLIST_TONES[report.blacklistStatus],
      blacklistReasons: report.blacklistReasons,
      nocIssuedTo: report.nocIssuedTo,
      challans: {
        total: report.challanCount,
        unpaid: report.challanUnpaidCount,
        outstandingPaise: Number(report.challanOutstandingPaise),
        outstandingLabel: formatRupees(report.challanOutstandingPaise),
        available: report.challansAvailable,
      },
      challanDetails: rows.map(toChallanDto),
      financed: report.financed,
      rcStatus: report.rcStatus,
      insuranceUpto: report.insuranceUpto?.toISOString() ?? null,
      fitnessUpto: report.fitnessUpto?.toISOString() ?? null,
      pucUpto: report.pucUpto?.toISOString() ?? null,
      taxUpto: report.taxUpto?.toISOString() ?? null,
    };
  }

  // ── the public projection ───────────────────────────────────────────────
  async function toPublicSummary(report: VehicleReport): Promise<VehicleReportSummary> {
    const verdict = verdictOf(report);
    const detailed = await config.boolean('report.publicDetail');
    const rows = challanRows(report);

    return {
      verdict,
      verdictLabel: REPORT_VERDICT_LABELS[verdict],
      verdictTone: REPORT_VERDICT_TONES[verdict],
      headline: headlineOf(report, verdict),
      asOfLabel: `as of ${formatDate(report.fetchedAt)}`,
      source: SOURCE,
      disclaimer: DISCLAIMER,
      blacklistStatus: report.blacklistStatus,
      blacklistLabel: BLACKLIST_LABELS[report.blacklistStatus],
      blacklistTone: BLACKLIST_TONES[report.blacklistStatus],
      // The *fact* that a flag exists, never the police reference or the
      // narrative that came with it. A buyer needs to know to ask; they do not
      // need a case file about a third party.
      blacklistNote:
        report.blacklistStatus === 'BLACKLISTED'
          ? 'Ask the dealer about this before paying a deposit.'
          : null,
      nocNote: report.nocIssuedTo
        ? `An NOC has been issued for transfer to ${report.nocIssuedTo}.`
        : null,
      challans: {
        available: report.challansAvailable,
        total: report.challanCount,
        unpaid: report.challanUnpaidCount,
        outstandingLabel: formatRupees(report.challanOutstandingPaise),
        summary: summariseOffences(rows, detailed),
      },
      financed: report.financed,
      validity: validityRows(report),
    };
  }

  return {
    toDealerDto,
    toPublicSummary,
    isStale,

    /** The current report for a vehicle, or null when none has been fetched. */
    async latest(vehicleId: string): Promise<VehicleReport | null> {
      return repo.latestForVehicle(vehicleId);
    },

    async latestDto(vehicleId: string): Promise<VehicleReportDto | null> {
      if (!(await config.boolean('feature.vehicleReport'))) return null;
      const report = await repo.latestForVehicle(vehicleId);
      return report ? toDealerDto(report) : null;
    },

    /** Batched, for a page of search results. One query, not one per card. */
    async publicSummaries(vehicleIds: string[]): Promise<Map<string, VehicleReportSummary>> {
      if (!(await config.boolean('feature.vehicleReport'))) return new Map();

      const rows = await repo.latestForVehicles(vehicleIds);
      const summaries = new Map<string, VehicleReportSummary>();
      for (const [vehicleId, report] of rows) {
        summaries.set(vehicleId, await toPublicSummary(report));
      }
      return summaries;
    },

    /** Records straight from the provider, without persisting. Used at intake. */
    async fetchRecords(registrationNumber: string): Promise<RcRecords> {
      return (await rc.lookup(registrationNumber)).records;
    },

    /** Writes a report row. Takes a tx so it can land with the draft it describes. */
    async append(
      tx: Prisma.TransactionClient | PrismaClient,
      input: { vehicleId: string; dealerId: string; records: RcRecords },
    ): Promise<VehicleReport> {
      return repo.append(tx, { ...input, provider: rc.provider });
    },

    /**
     * Re-fetch if the current report is stale. Returns the freshest we have.
     *
     * **Never throws.** This runs inside `submit()`, and a records vendor
     * having a bad afternoon must not stop a dealer publishing a car. A stale
     * report with an honest `asOf` date is a worse report but a truthful one;
     * a failed submission is a lost listing.
     */
    async refreshIfStale(
      vehicleId: string,
      dealerId: string,
      registrationNumber: string | null,
    ): Promise<VehicleReport | null> {
      if (!(await config.boolean('feature.vehicleReport'))) return null;

      const current = await repo.latestForVehicle(vehicleId);
      if (current && !(await isStale(current))) return current;
      if (!registrationNumber) return current;

      try {
        const records = await this.fetchRecords(registrationNumber);
        return await repo.append(prisma, { vehicleId, dealerId, provider: rc.provider, records });
      } catch (error) {
        logger.warn(
          { err: error, vehicleId, provider: rc.provider },
          'report refresh failed — keeping the existing report',
        );
        return current;
      }
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;

function toChallanDto(row: ChallanRecord): ChallanDto {
  return {
    challanRef: row.challanRef,
    offenceDate: row.offenceDate,
    offence: row.offence,
    amountPaise: row.amountPaise,
    amountLabel: formatRupees(row.amountPaise),
    status: row.status,
    statusLabel: CHALLAN_STATUS_LABELS[row.status],
    court: row.court,
  };
}

/**
 * Offence types for the public summary.
 *
 * Deduplicated and counted, with the year but not the date, and never the
 * challan reference. "Over-speeding × 2 (2025)" tells a buyer everything that
 * changes their decision; the challan number and exact date tell them nothing
 * and identify a specific enforcement event against a specific person.
 *
 * Under `report.publicDetail` the dates widen to full dates — still no
 * references, and still no names or places, because those are stripped at the
 * adapter and were never stored.
 */
function summariseOffences(rows: ChallanRecord[], detailed: boolean): string[] {
  const counts = new Map<string, { count: number; years: Set<string> }>();

  for (const row of rows) {
    const entry = counts.get(row.offence) ?? { count: 0, years: new Set<string>() };
    entry.count += 1;
    if (row.offenceDate) {
      const date = new Date(row.offenceDate);
      if (!Number.isNaN(date.getTime())) {
        entry.years.add(detailed ? formatDate(date) : String(date.getUTCFullYear()));
      }
    }
    counts.set(row.offence, entry);
  }

  return [...counts.entries()].map(([offence, entry]) => {
    const when = [...entry.years].sort().join(', ');
    const times = entry.count > 1 ? ` × ${entry.count}` : '';
    return when ? `${offence}${times} (${when})` : `${offence}${times}`;
  });
}
