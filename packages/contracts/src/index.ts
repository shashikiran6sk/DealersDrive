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
 * This barrel is deliberately empty at `chore: initialize project`. Each
 * feature adds its own module and its own export line, in the order set by
 * `docs/project/feature-map.md`. F001 adds `common.ts` and `enums.ts`.
 */

/** Bumped when a breaking change ships; surfaced in the API's /health/ready. */
export const CONTRACTS_VERSION = '1.0.0';
