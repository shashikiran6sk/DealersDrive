/**
 * @dealers-drive/contracts
 *
 * The single source of truth for every shape that crosses the wire. A schema
 * defined here is parsed by the API (`validate({ body })`) and reused by the
 * web app for form validation and typed responses — one definition, both ends.
 *
 * Filled in from Day 5 onwards:
 *   common.ts    — Pagination, IdParam, ProblemDetails, Money
 *   vehicle.ts   — CreateVehicleInput, VehicleQuery, VehicleDto
 *   dealer.ts    — SignupInput, DealerProfileDto
 *   listing.ts   — ListingDto, ListingStatus
 *   search.ts    — the 13 public filters
 *
 * Empty today by design — Day 1 only proves the wiring.
 */

/** Bumped when a breaking change ships; surfaced in the API's /health/ready. */
export const CONTRACTS_VERSION = '0.0.0';
