/**
 * The only part of `search` other modules may import (ARCHITECTURE §5.5 rule 3).
 *
 * Two things, deliberately: the read model's repository type — enquiries and
 * catalog need to *look up* a live listing, which is the one question only the
 * catalogue can answer — and the body-type label, which admin renders on the
 * moderation card. Everything else about how search works stays inside.
 */
export type { SearchRepository, SearchRow } from './search.repository.js';
export { bodyTypeLabel } from './search.mapper.js';
