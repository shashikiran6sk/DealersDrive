/**
 * @dealers-drive/contracts
 *
 * The single source of truth for every shape that crosses the wire. A schema
 * defined here is parsed by the API (`validate({ body })`) and reused by the
 * web app for form validation and typed responses — one definition, both ends.
 *
 * Two rules govern everything in this package:
 *   1. Every input schema is `.strict()`. An unknown field is a 400, never a
 *      silent ignore (CLAUDE.md rule 2).
 *   2. No input schema accepts `dealerId`, `status` or `slug`. Those come from
 *      the session and from the state machine (CLAUDE.md rules 1 and 5).
 *
 * Each feature adds its own module and its own export line, in the order set
 * by `docs/project/feature-map.md`. `public`, `dealer` and `admin` each grow
 * shape by shape, as the feature that answers with one lands.
 */

export * from './common.js';
export * from './enums.js';
export * from './auth.js';
export * from './public.js';
export * from './dealer.js';
export * from './admin.js';

/** Bumped when a breaking change ships; surfaced in the API's /health/ready. */
export const CONTRACTS_VERSION = '1.0.0';
