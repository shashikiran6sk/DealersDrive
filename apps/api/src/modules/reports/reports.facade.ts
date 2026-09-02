/**
 * `reports` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * `vehicles`, `search` and `admin` all render a report and none of them
 * reaches the repository — the projections in `reports.service.ts` are the
 * privacy boundary, and a module that could read `VehicleReport` rows directly
 * could serialise an itemised challan onto a public page without passing
 * through them.
 */
export type { ReportsService } from './reports.service.js';
export type { ReportsRepository } from './reports.repository.js';
