import type { VehicleOptionField } from './vehicle-option-select.types';

export const VEHICLE_SUGGESTIONS_PATH = {
  dealer: '/api/dealer/vehicles/suggestions',
  sales: (dealerId: string) => `/api/sales/dealers/${dealerId}/vehicles/suggestions`,
  admin: (listingId: string) => `/api/admin/listings/${listingId}/vehicle/suggestions`,
} as const;

const NOUN: Record<VehicleOptionField, string> = { model: 'model', variant: 'variant' };

export const VEHICLE_OPTION_TEXT = {
  listLabel: { model: 'Models', variant: 'Variants' } satisfies Record<VehicleOptionField, string>,
  needsParent: {
    model: 'Choose the make first',
    variant: 'Choose the model first',
  } satisfies Record<VehicleOptionField, string>,
  loading: 'Loading…',
  noneYet: (field: VehicleOptionField, parent: string) =>
    `No ${parent} ${NOUN[field]}s listed yet. Type the ${NOUN[field]} as on the RC.`,
  notListed: (field: VehicleOptionField) => `Not listed? Type the ${NOUN[field]} name.`,
  addNew: (field: VehicleOptionField, value: string) => `Add “${value}” as a new ${NOUN[field]}`,
  failed: (field: VehicleOptionField) =>
    `Could not load the list. Type the ${NOUN[field]} as on the RC.`,
} as const;
