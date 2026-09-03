/**
 * `dealers` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * Repository types only. Four modules need to read a dealership — vehicles to
 * check it is active before publishing, billing to price an order, enquiries to
 * route a lead, search to render the card — and all four do it through the same
 * scoped repository rather than reaching for prisma themselves.
 */
export type { DealersRepository, DealerWithRelations } from './dealers.repository.js';
