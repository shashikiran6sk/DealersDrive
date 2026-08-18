/**
 * `enquiries` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * Only the repository type: the dealer profile's "median response time" is
 * computed from leads, and that is the one thing another module legitimately
 * needs from this one. The cursor helpers that used to be imported from here
 * were never enquiry logic and now live in `platform/pagination.ts`.
 */
export type { EnquiriesRepository } from './enquiries.repository.js';
