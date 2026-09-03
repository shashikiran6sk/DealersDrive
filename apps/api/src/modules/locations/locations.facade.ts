/**
 * `locations` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * The repository, because four modules need to resolve a city slug — dealers
 * on onboarding, vehicles on intake, search on a filter, and the public
 * directory — and all four do it through the same lookup rather than reaching
 * for prisma themselves.
 */
export type { LocationsRepository } from './locations.repository.js';
export type { LocationsService, CityCountsPort } from './locations.service.js';
