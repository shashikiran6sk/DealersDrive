import { z } from 'zod';

import { CursorPage } from './common.js';
import { VehicleCardDto } from './public.js';

/**
 * A customer's saved cars (**R74**, revising F087's device-only list).
 *
 * Addressed by the listing's public slug, the only identifier a buyer ever
 * has; the customer is the session, never a parameter. A saved car keeps its
 * row whatever happens to the listing, so the card's `availability` is what
 * tells the page how to draw it: AVAILABLE and RESERVED are still on the
 * marketplace; SOLD and UNAVAILABLE are not, and carry no photograph (the
 * media route no longer serves it).
 */
export const SAVED_VEHICLES_PAGE = 24;

export const SAVED_SLUGS_MAX = 500;

export const SavedVehiclesQuery = z
  .object({
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(SAVED_VEHICLES_PAGE),
  })
  .strict();
export type SavedVehiclesQuery = z.infer<typeof SavedVehiclesQuery>;

export const SavedVehicle = z.object({
  savedAt: z.string(),
  vehicle: VehicleCardDto,
});
export type SavedVehicle = z.infer<typeof SavedVehicle>;

export const SavedVehiclesResponse = z.object({
  data: z.array(SavedVehicle),
  page: CursorPage,
});
export type SavedVehiclesResponse = z.infer<typeof SavedVehiclesResponse>;

/** Every slug the customer has saved, so any card can draw its heart without a request each. */
export const SavedVehicleSlugs = z.object({
  slugs: z.array(z.string()).max(SAVED_SLUGS_MAX),
});
export type SavedVehicleSlugs = z.infer<typeof SavedVehicleSlugs>;

/** The answer to a save or an unsave: where the car now stands for this customer. */
export const SavedState = z.object({
  slug: z.string(),
  saved: z.boolean(),
});
export type SavedState = z.infer<typeof SavedState>;
