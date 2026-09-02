import { env } from '../../config/env.js';
import { logger } from '../telemetry/logger.js';
import {
  RcLookupError,
  type ChallanRecord,
  type RcLookupPort,
  type RcLookupResult,
  type RcRecords,
  type RcSpecs,
} from './rc.port.js';

/**
 * Attestr — the production RC provider (ARCHITECTURE §6.3).
 *
 * Selected by `RC_LOOKUP_DRIVER=attestr`; `env.ts` refuses to start without the
 * auth token when it is. Nothing above `RcLookupPort` changes: the same
 * service that reads a deterministic mock locally posts to Attestr here.
 *
 * **Verified against the documented API shape, not against Attestr itself** —
 * this build has no Attestr account, so the request is unit-tested with a
 * stubbed `fetch` and the first real lookup should be watched. This is the same
 * position `msg91.adapter.ts` is in, and it is why Attestr was chosen over
 * providers whose response schema is only available after a sales call: an
 * adapter cannot be written, let alone tested, against prose.
 *
 * ## Why every field is copied by name
 *
 * There is no spread and no `Object.assign` anywhere below. A response carries
 * the owner's name, father's name, both addresses, mobile number, chassis and
 * engine numbers, the financier, and a named person on every challan. Copying
 * by name means adding a provider field to our domain is a deliberate edit
 * rather than something that happens when Attestr extends its response.
 */
const DEFAULT_BASE_URL = 'https://api.attestr.com/api/v2';

export function createAttestrRcLookup(fetchImpl: typeof fetch = fetch): RcLookupPort {
  return {
    provider: 'attestr',

    async lookup(registrationNumber: string): Promise<RcLookupResult> {
      const url = `${env.ATTESTR_BASE_URL ?? DEFAULT_BASE_URL}/public/checkx/rc`;

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // A header, never a query parameter: URLs end up in access logs and
            // this one is a credential.
            Authorization: `Basic ${env.ATTESTR_AUTH_TOKEN ?? ''}`,
          },
          body: JSON.stringify({ reg: registrationNumber }),
          // Without this the dealer watches a spinner for as long as Attestr
          // feels like taking. The lookup is on the critical path of adding a
          // car, and the manual form is one click away — failing fast is
          // strictly better than succeeding slowly.
          signal: AbortSignal.timeout(env.RC_LOOKUP_TIMEOUT_MS),
        });
      } catch (error) {
        // A timeout and a DNS failure are the same thing to a dealer.
        throw new RcLookupError(
          'UNAVAILABLE',
          error instanceof Error && error.name === 'TimeoutError'
            ? 'The vehicle records service did not respond in time.'
            : 'The vehicle records service could not be reached.',
        );
      }

      if (!response.ok) throw failureFor(response.status, await safeBody(response));

      const body = (await response.json()) as Record<string, unknown>;

      // A well-formed 200 that says the RC does not exist. Not an error at the
      // transport level, but it is `NOT_FOUND` to everyone above.
      if (body.valid === false) {
        throw new RcLookupError(
          'NOT_FOUND',
          typeof body.message === 'string' && body.message.length > 0
            ? body.message
            : 'No registration certificate is on record for that number.',
        );
      }

      return { specs: toSpecs(body), records: toRecords(body) };
    },
  };
}

/**
 * Attestr's documented error codes, mapped to what the dealer should be told.
 *
 * The distinction that matters: 4005 (our credits are exhausted) and 4039 (our
 * IP is not whitelisted) are **our** problems. They must never surface as
 * "there is something wrong with your vehicle" — the dealer sees the same
 * generic unavailability as a timeout, and the operator gets paged by the log
 * line instead.
 */
function failureFor(status: number, body: Record<string, unknown>): RcLookupError {
  const code = typeof body.code === 'number' ? String(body.code) : undefined;

  if (code === '4005' || code === '4016' || code === '4031' || code === '4035' || code === '4039') {
    logger.error(
      { provider: 'attestr', status, code },
      'rc lookup rejected for an account reason — credits, credentials or IP allowlist',
    );
    return new RcLookupError(
      'MISCONFIGURED',
      'The vehicle records service is not available right now.',
      code,
    );
  }

  if (status === 429) {
    logger.warn({ provider: 'attestr', code }, 'rc lookup rate limited by the provider');
    return new RcLookupError(
      'RATE_LIMITED',
      'The vehicle records service is busy. Try again shortly.',
      code,
    );
  }

  if (status === 400) {
    // We validated the plate before sending it, so a 400 means our request
    // shape drifted from theirs — a deploy problem, not a dealer problem.
    logger.error({ provider: 'attestr', status, code }, 'rc lookup rejected as malformed');
    return new RcLookupError(
      'UNAVAILABLE',
      'The vehicle records service rejected the request.',
      code,
    );
  }

  logger.error({ provider: 'attestr', status, code }, 'rc lookup failed');
  return new RcLookupError('UNAVAILABLE', 'The vehicle records service is not responding.', code);
}

async function safeBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─────────── mapping ───────────────────────────────────────────────────────

function toSpecs(body: Record<string, unknown>): RcSpecs {
  return {
    makerDescription: str(body.makerDescription),
    makerModel: str(body.makerModel),
    makerVariant: str(body.makerVariant),
    fuelType: str(body.fuelType),
    colorType: str(body.colorType),
    cubicCapacity: num(body.cubicCapacity),
    seatingCapacity: num(body.seatingCapacity),
    normsType: str(body.normsType),
    ownerNumber: num(body.ownerNumber),
    manufacturedOn: date(body.manufactured),
    registeredOn: date(body.registered),
    rtoName: str(body.rto),
  };
  // Deliberately absent, and present in `body`: owner, father, mobile,
  // currentAddress, permanentAddress, chassisNumber, engineNumber, lender,
  // exShowroomPrice, insuranceProvider, insurancePolicyNumber,
  // pollutionCertificateNumber, permitNumber and the national-permit block.
}

function toRecords(body: Record<string, unknown>): RcRecords {
  const challanRows = Array.isArray(body.challanDetails) ? body.challanDetails : null;

  return {
    rcStatus: str(body.status),
    blacklistStatus: blacklistStatusFrom(body),
    blacklistReasons: reasonsFrom(body.blacklistDetails),
    nocIssuedTo: nocStateFrom(body.nocDetails),
    // `null` from the provider means the state's feed said nothing; an empty
    // array means it answered "none". Those are different reports.
    challansAvailable: challanRows !== null,
    challans: (challanRows ?? [])
      .map(toChallan)
      .filter((row): row is ChallanRecord => row !== null),
    financed: typeof body.financed === 'boolean' ? body.financed : null,
    insuranceUpto: date(body.insuranceUpto),
    fitnessUpto: date(body.fitnessUpto),
    pucUpto: date(body.pollutionCertificateUpto),
    taxUpto: date(body.taxUpto),
  };
}

/**
 * One challan, stripped to the six fields a buyer or dealer can act on.
 *
 * `name_of_violator`, `driver_name`, `owner_name`, `offender_mobile_number`,
 * `dl_number` and `challan_place` are all present in provider responses and
 * none of them is read here.
 */
function toChallan(raw: unknown): ChallanRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;

  const offence = str(row.offence) ?? str(row.offenceDetails) ?? str(row.violation);
  const rupees = num(row.amount) ?? num(row.fineImposed) ?? 0;
  const reference = str(row.challanNumber) ?? str(row.challanNo) ?? '';

  return {
    // Last four only. Enough to find the challan on the government portal,
    // useless for enumerating anybody else's.
    challanRef: reference.length > 4 ? reference.slice(-4) : reference,
    offenceDate: date(row.challanDate) ?? date(row.offenceDate),
    offence: offence ?? 'Traffic violation',
    // Providers quote rupees. Storing that as-is would be the money bug Rule 3
    // exists to prevent.
    amountPaise: Math.round(rupees * 100),
    status: challanStatusFrom(str(row.status) ?? str(row.challanStatus)),
    court: /court/i.test(str(row.status) ?? str(row.challanStatus) ?? ''),
  };
}

function challanStatusFrom(raw: string | null): ChallanRecord['status'] {
  const value = (raw ?? '').toLowerCase();
  if (value.includes('court') || value.includes('dispos')) return 'DISPOSED';
  if (value.includes('paid') && !value.includes('unpaid')) return 'PAID';
  // Unknown reads as UNPAID on purpose: understating an outstanding fine is
  // the error that costs a buyer money.
  return 'UNPAID';
}

function blacklistStatusFrom(body: Record<string, unknown>): RcRecords['blacklistStatus'] {
  const status = (str(body.status) ?? '').toUpperCase();
  const flag = body.blacklistStatus;
  const details = Array.isArray(body.blacklistDetails) ? body.blacklistDetails : [];

  if (flag === true || details.length > 0) return 'BLACKLISTED';
  if (status.includes('NOC')) return 'NOC_ISSUED';
  if (flag === false) return 'CLEAR';

  // Neither a flag nor a usable status. `UNKNOWN`, never `CLEAR` — see the
  // note on `RcRecords.blacklistStatus`.
  return 'UNKNOWN';
}

function reasonsFrom(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (typeof entry !== 'object' || entry === null) return null;
      const row = entry as Record<string, unknown>;
      return str(row.reason) ?? str(row.remarks) ?? str(row.type);
    })
    .filter((entry): entry is string => entry !== null && entry.length > 0);
}

/** The destination state of an NOC. Never the person it was issued to. */
function nocStateFrom(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  return str(row.state) ?? str(row.toRto) ?? str(row.destination);
}

// ─────────── tolerant readers ──────────────────────────────────────────────
//
// Every one of these returns null rather than throwing. A single unparseable
// field must degrade that field, not lose the whole report — a dealer who
// cannot see an insurance date should still see the blacklist status.

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  // Providers use these interchangeably with an absent key.
  if (trimmed === '' || trimmed === 'NA' || trimmed === 'N/A' || trimmed === '-') return null;
  return trimmed;
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const digits = value.replace(/[^\d.-]/g, '');
  // `Number('')` is 0, not NaN. Without this guard an unreadable cubic
  // capacity becomes 0, and 0 is not "unknown" to the variant filter — it
  // rules out every variant, so a match failure would look like a car with no
  // variants rather than a field we could not read.
  if (digits === '' || digits === '-' || digits === '.') return null;

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/**
 * RC dates arrive as `2027-03-31`, `31-Mar-2027` or `31/03/2027` depending on
 * which state's record it came from. All three are parsed; anything else
 * becomes null rather than an `Invalid Date` that reaches the database.
 */
function date(value: unknown): string | null {
  const raw = str(value);
  if (raw === null) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return utc(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const named = /^(\d{1,2})[-/\s]([A-Za-z]{3})[A-Za-z]*[-/\s](\d{4})$/.exec(raw);
  if (named) {
    const month = MONTHS[(named[2] ?? '').toLowerCase()];
    if (month === undefined) return null;
    return utc(Number(named[3]), month, Number(named[1]));
  }

  const numeric = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(raw);
  // Day first: an Indian RC never uses month-first, and guessing wrong turns
  // 03/04 into the wrong month for eleven days of every twelve.
  if (numeric) return utc(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]));

  return null;
}

function utc(year: number, month: number, day: number): string | null {
  const value = new Date(Date.UTC(year, month, day));
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}
