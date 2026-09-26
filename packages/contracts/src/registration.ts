import { z } from 'zod';

/**
 * Indian registration numbers — typed by a dealer, stored once, shown readably
 * (**F056**, and under **R46** the only thing between `KA-01-AB-1234`,
 * `ka01ab1234` and `KA 01 AB 1234` becoming three cars).
 *
 * Not one regular expression. A plate is read as a sequence of letter and digit
 * *runs*, and three shapes are recognised from those runs:
 *
 *   · **STATE** — `KA 01 AB 1234`, `DL 3C AB 1234`, `TN 09 1234` (no series). A
 *     known state or union-territory code, a one- or two-digit RTO number, a
 *     series of up to three letters, and a number of up to four digits.
 *   · **BH** — `22 BH 1234 AA`, the Bharat series: two-digit year, `BH`, four
 *     digits, one or two letters. It belongs to no RTO.
 *   · **LEGACY** — `MDU 1234`, the three-letter series older cars still carry.
 *
 * Runs rather than a pattern because the separators a dealer types are
 * information: `KA 1 123` is RTO 1, number 123, and a single regular expression
 * over `KA1123` cannot know that. Where nothing separates the RTO number from
 * the plate number (`KA1123` — only possible with no series letters) the RTO
 * takes two digits, which is how every such plate issued since 1989 reads.
 *
 * **Canonical form pads.** `KA 1 AB 1` and `KA 01 AB 0001` are one car, so the
 * RTO number is stored as two digits and the plate number as four. The stored
 * value is upper-case and unseparated; `display` is the only formatted form.
 */
export const STATE_CODES = [
  'AN',
  'AP',
  'AR',
  'AS',
  'BR',
  'CG',
  'CH',
  'DD',
  'DL',
  'DN',
  'GA',
  'GJ',
  'HP',
  'HR',
  'JH',
  'JK',
  'KA',
  'KL',
  'LA',
  'LD',
  'MH',
  'ML',
  'MN',
  'MP',
  'MZ',
  'NL',
  'OD',
  'OR',
  'PB',
  'PY',
  'RJ',
  'SK',
  'TG',
  'TN',
  'TR',
  'TS',
  'UA',
  'UK',
  'UP',
  'WB',
] as const;

const STATE_CODE_SET: ReadonlySet<string> = new Set(STATE_CODES);

export type RegistrationKind = 'STATE' | 'BH' | 'LEGACY';

export interface ParsedRegistration {
  kind: RegistrationKind;
  /** Upper-case, unseparated, padded: `KA01AB0001`. What the database stores. */
  canonical: string;
  /** `KA 01 AB 0001`. What a person reads. */
  display: string;
  /** `KA01`, or null for a BH or legacy plate, which name no RTO. */
  rtoCode: string | null;
}

export type RegistrationResult =
  { ok: true; value: ParsedRegistration } | { ok: false; message: string };

export const REGISTRATION_MESSAGES = {
  empty: 'Enter the registration number.',
  characters: 'Use only letters, numbers, spaces and hyphens.',
  state: 'Start with the two-letter state code, for example KA or TN.',
  shape: 'That does not look like a registration number. For example: KA 01 AB 1234.',
  zero: 'The number on the plate cannot be all zeros.',
} as const;

const SEPARATORS = /[\s\-./]+/;
const ALLOWED = /^[A-Za-z0-9\s\-./]+$/;

interface Run {
  text: string;
  digits: boolean;
}

interface Reading extends ParsedRegistration {
  /** The number on the plate itself, which may not be all zeros. */
  number: string;
}

function runsOf(raw: string): Run[] {
  const runs: Run[] = [];
  for (const chunk of raw.trim().toUpperCase().split(SEPARATORS)) {
    for (const text of chunk.match(/[A-Z]+|\d+/g) ?? []) {
      runs.push({ text, digits: /^\d/.test(text) });
    }
  }
  return runs;
}

function mergeLetters(runs: Run[]): Run[] {
  const merged: Run[] = [];
  for (const run of runs) {
    const previous = merged[merged.length - 1];
    if (previous && !previous.digits && !run.digits) {
      merged[merged.length - 1] = { text: previous.text + run.text, digits: false };
    } else {
      merged.push(run);
    }
  }
  return merged;
}

function pad(value: string, width: number): string {
  return value.padStart(width, '0');
}

function bharat(runs: Run[]): Reading | null {
  const [year, series, number, letters] = runs;
  if (runs.length !== 4 || !year || !series || !number || !letters) return null;
  if (!year.digits || year.text.length !== 2) return null;
  if (series.digits || series.text !== 'BH') return null;
  if (!number.digits || number.text.length !== 4) return null;
  if (letters.digits || letters.text.length > 2) return null;

  return {
    kind: 'BH',
    canonical: `${year.text}BH${number.text}${letters.text}`,
    display: `${year.text} BH ${number.text} ${letters.text}`,
    rtoCode: null,
    number: number.text,
  };
}

function legacy(runs: Run[]): Reading | null {
  const [series, number] = runs;
  if (runs.length !== 2 || !series || !number) return null;
  if (series.digits || series.text.length !== 3 || !number.digits || number.text.length > 4) {
    return null;
  }

  return {
    kind: 'LEGACY',
    canonical: `${series.text}${number.text}`,
    display: `${series.text} ${number.text}`,
    rtoCode: null,
    number: number.text,
  };
}

function stateSeries(runs: Run[]): Reading | null {
  const [state, ...tail] = runs;
  if (!state || state.digits || state.text.length !== 2) return null;

  const rest = mergeLetters(tail);
  const [first, second, third] = rest;
  let rto: string;
  let series = '';
  let number: string;

  if (rest.length === 3 && first?.digits && second && !second.digits && third?.digits) {
    rto = first.text;
    series = second.text;
    number = third.text;
  } else if (rest.length === 2 && first?.digits && second?.digits) {
    rto = first.text;
    number = second.text;
  } else if (rest.length === 1 && first?.digits && first.text.length > 2) {
    rto = first.text.slice(0, 2);
    number = first.text.slice(2);
  } else {
    return null;
  }

  if (rto.length > 2 || series.length > 3 || number.length > 4) return null;

  const rtoCode = `${state.text}${pad(rto, 2)}`;
  const plate = pad(number, 4);

  return {
    kind: 'STATE',
    canonical: `${rtoCode}${series}${plate}`,
    display: [state.text, pad(rto, 2), series, plate].filter(Boolean).join(' '),
    rtoCode,
    number,
  };
}

/**
 * Reads what a dealer typed. Never throws; a refusal carries the sentence to
 * show beside the field.
 */
export function parseRegistration(raw: string): RegistrationResult {
  if (!raw.trim()) return { ok: false, message: REGISTRATION_MESSAGES.empty };
  if (!ALLOWED.test(raw)) return { ok: false, message: REGISTRATION_MESSAGES.characters };

  const runs = runsOf(raw);

  const reading = bharat(runs) ?? legacy(runs) ?? stateSeries(runs);
  if (!reading) {
    const head = runs[0];
    if (head && !head.digits && head.text.length === 2 && !STATE_CODE_SET.has(head.text)) {
      return { ok: false, message: REGISTRATION_MESSAGES.state };
    }
    return { ok: false, message: REGISTRATION_MESSAGES.shape };
  }

  if (reading.kind === 'STATE' && !STATE_CODE_SET.has(reading.canonical.slice(0, 2))) {
    return { ok: false, message: REGISTRATION_MESSAGES.state };
  }
  if (/^0+$/.test(reading.number)) return { ok: false, message: REGISTRATION_MESSAGES.zero };

  const { number: _number, ...parsed } = reading;
  return { ok: true, value: parsed };
}

/** The canonical form, or null when the input is not a registration number. */
export function normaliseRegistration(raw: string): string | null {
  const result = parseRegistration(raw);
  return result.ok ? result.value.canonical : null;
}

/**
 * A stored canonical value, formatted for a person. Falls back to the stored
 * value unchanged, so a row written before a rule existed still renders.
 */
export function formatRegistration(canonical: string): string {
  const result = parseRegistration(canonical);
  return result.ok ? result.value.display : canonical;
}

/**
 * The schema both apps parse a registration number with. Output is the
 * canonical string; a failure names the problem in words a dealer can act on.
 */
export const RegistrationNumber = z
  .string()
  .max(24, REGISTRATION_MESSAGES.shape)
  .transform((raw, context) => {
    const result = parseRegistration(raw);
    if (!result.ok) {
      context.addIssue({ code: 'custom', message: result.message });
      return z.NEVER;
    }
    return result.value.canonical;
  });
