/**
 * Vehicle registration lookup, behind one narrow port (ARCHITECTURE §6.3).
 *
 * ## Two return types, because there are two kinds of data
 *
 * A provider answers one call with facts that behave nothing alike, and the
 * split is the whole design:
 *
 *   `RcSpecs`   — immutable. A 2019 Swift is a 2019 Swift forever. Cached 30
 *                 days in `rc_lookups`, keyed by a hash of the plate.
 *   `RcRecords` — mutable, and a **claim we publish**. A challan can be issued
 *                 tomorrow and paid the day after. Cached 24 hours, re-fetched
 *                 at submit, and written append-only to `vehicle_reports`.
 *
 * Splitting the types rather than only the storage is what keeps the caching
 * honest: a 30-day cache physically cannot hold a challan list, because
 * `RcSpecs` has no field for one.
 *
 * ## This file is the privacy boundary
 *
 * A full RC response carries the registered owner's name, father's name,
 * current and permanent address, mobile number, chassis number, engine number,
 * financier, and the name of every person named on a challan. None of it is
 * needed to publish or buy a listing, and all of it is a liability under the
 * DPDP Act.
 *
 * None of those fields exist below. Adapters drop them *before constructing*
 * these objects, so personal data never enters the domain, never reaches a log
 * line, and cannot be persisted by a later feature whose author did not know
 * to exclude it. The absence of a field is the enforcement — a code review
 * comment would not be.
 *
 * `Msg91Sms` is the shape to imitate here: the port names no provider, and
 * swapping Attestr for Surepass is a new file plus one line in `factory.ts`.
 */

/** Immutable vehicle facts. Safe to cache for a month. */
export interface RcSpecs {
  /** As printed on the RC: "MARUTI SUZUKI INDIA LTD". Resolved by `rc-match`. */
  makerDescription: string | null;
  /** "SWIFT VXI" — model and trim run together, inconsistently. */
  makerModel: string | null;
  makerVariant: string | null;
  fuelType: string | null;
  colorType: string | null;
  cubicCapacity: number | null;
  seatingCapacity: number | null;
  /** BS4 / BS6. Price-relevant on an Indian used car and unavailable elsewhere. */
  normsType: string | null;
  ownerNumber: number | null;
  /** ISO date. Preferred over `registeredOn` for the model year. */
  manufacturedOn: string | null;
  registeredOn: string | null;
  /** The RTO's name. Informational only — `rtoCode` is derived from the plate. */
  rtoName: string | null;
}

/**
 * One traffic challan, as we are willing to hold it.
 *
 * Dropped on the way in, from every provider: `name_of_violator`,
 * `driver_name`, `owner_name`, `accused_name`, `offender_mobile_number`,
 * `dl_number`, and `challan_place`.
 *
 * The first six identify a third party who never agreed to appear on our
 * marketplace. `challan_place` is subtler and is dropped on the same
 * reasoning: place plus date across several challans is a movement trace of a
 * person, and it tells a buyer nothing that the offence and the date do not.
 *
 * `challanRef` is the last four characters of the challan number — enough for
 * a dealer to find it on the government portal, useless for enumeration.
 */
export interface ChallanRecord {
  challanRef: string;
  /** ISO date, or null when the provider gave an unparseable one. */
  offenceDate: string | null;
  offence: string;
  amountPaise: number;
  status: 'PAID' | 'UNPAID' | 'DISPOSED';
  /** Referred to court. Materially worse than merely unpaid, and priced so. */
  court: boolean;
}

/** Mutable claims. Short-lived, timestamped, and published under a disclaimer. */
export interface RcRecords {
  /** "ACTIVE", "NOC ISSUED", "SCRAPPED" — verbatim from the provider. */
  rcStatus: string | null;
  /**
   * `UNKNOWN` is not `CLEAR`, and the two must never be collapsed. A provider
   * outage rendering as a clean bill of health on a stolen car is the single
   * worst failure this feature can produce.
   */
  blacklistStatus: 'CLEAR' | 'BLACKLISTED' | 'NOC_ISSUED' | 'UNKNOWN';
  blacklistReasons: string[];
  /** A state, never a person: "Karnataka". */
  nocIssuedTo: string | null;
  /**
   * False when the state's challan feed returned nothing at all.
   *
   * Distinct from an empty `challans` array with `available: true`, which
   * means "we asked and there are none". Every layer above preserves this
   * distinction, and the public report renders it as "records unavailable"
   * rather than as a clean record.
   */
  challansAvailable: boolean;
  challans: ChallanRecord[];
  /** Whether a loan is on record. The lender's name is never stored. */
  financed: boolean | null;
  insuranceUpto: string | null;
  fitnessUpto: string | null;
  pucUpto: string | null;
  taxUpto: string | null;
}

export interface RcLookupResult {
  specs: RcSpecs;
  records: RcRecords;
}

/**
 * Why a lookup failed, in terms the service can map to HTTP without knowing
 * which provider produced it.
 *
 * The port stays free of HTTP concerns — like `StoragePort` and `SmsPort`, it
 * throws plain errors and lets the module above decide what they mean to a
 * caller. `kind` exists so that mapping is a switch rather than string
 * matching on a vendor's prose.
 */
export type RcFailureKind =
  /** The registration is well-formed but no RC is on record. */
  | 'NOT_FOUND'
  /** Provider down, timed out, or returned a shape we could not read. */
  | 'UNAVAILABLE'
  /** Our account is over the provider's limit — never the dealer's fault. */
  | 'RATE_LIMITED'
  /** Our credentials or credits are wrong. An operational alert, not a user message. */
  | 'MISCONFIGURED';

export class RcLookupError extends Error {
  readonly kind: RcFailureKind;
  /** The provider's own code, for the log line. Never shown to a dealer. */
  readonly providerCode: string | undefined;

  constructor(kind: RcFailureKind, message: string, providerCode?: string) {
    super(message);
    this.name = 'RcLookupError';
    this.kind = kind;
    this.providerCode = providerCode;
  }
}

export interface RcLookupPort {
  /** Names the active adapter. Recorded on every report row; never branched on. */
  readonly provider: string;

  /**
   * Look up one registration. The number arrives already normalised by
   * `REGISTRATION_NUMBER` — no spaces, no hyphens, upper case.
   *
   * Throws `RcLookupError`. Never returns a partially-populated result to
   * signal failure: a caller that has an `RcLookupResult` may trust every
   * field in it, including the negative ones.
   */
  lookup(registrationNumber: string): Promise<RcLookupResult>;
}
