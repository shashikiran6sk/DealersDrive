/** `vehicles` as other modules see it (ARCHITECTURE §5.5 rule 3). */
export type { VehiclesRepository, VehicleWithRelations } from './vehicles.repository.js';
/**
 * The service *type* only, for the report routes.
 *
 * C22 and C23 live at `/vehicles/:id/report` and delegate to `vehicles`,
 * which owns the ownership check — a router that could read a report by id
 * alone would be one refactor from serving one dealer's records to another.
 * Reaching the type through the facade is what keeps that dependency
 * declared rather than smuggled in through a deep import.
 */
export type { VehiclesService } from './vehicles.service.js';
