export const SALES_VEHICLE_TEXT = {
  heading: 'Listings I prepared',
  start: 'Start a listing',
  empty: 'No listings yet. Start one with the dealer’s registration number.',
  notApproved:
    'Drafts can be prepared now. They can be submitted for review once the dealership is approved.',
  closed: 'This dealership is suspended, rejected or closed, so no new listings can be started.',
  open: 'Open',
  newIntro:
    'You are preparing this listing on the dealer’s behalf. It appears in their inventory, and a reviewer other than you decides on it.',
  onBehalf: 'Prepared by you on the dealer’s behalf.',
  newHref: (dealerId: string) => `/sales/dealers/${dealerId}/vehicles/new`,
  editHref: (dealerId: string, vehicleId: string) =>
    `/sales/dealers/${dealerId}/vehicles/${vehicleId}/edit?step=review`,
} as const;
