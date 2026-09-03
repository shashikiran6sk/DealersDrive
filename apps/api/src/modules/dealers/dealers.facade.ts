/**
 * `dealers` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * Repository types only. Four modules need to read a dealership — vehicles to
 * check it is active before publishing, billing to price an order, enquiries to
 * route a lead, search to render the card — and all four do it through the same
 * scoped repository rather than reaching for prisma themselves.
 */
export type { DealersRepository, DealerWithRelations } from './dealers.repository.js';
/**
 * One consumer, and only for `session()`: the auth module composes the session
 * body it returns from `/v1/auth/me` out of the dealership half this service
 * renders. It is a type-only export, so nothing is constructed across the
 * boundary — the container still does the wiring.
 */
export type { DealersService } from './dealers.service.js';
