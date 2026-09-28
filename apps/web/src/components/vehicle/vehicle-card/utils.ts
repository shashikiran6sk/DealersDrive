import { PUBLIC_AVAILABILITY_LABELS, type PublicAvailability } from '@dealers-drive/contracts';

import { VEHICLE_CARD_TEXT } from './vehicle-card.constants';

export function availabilityLabel(availability: PublicAvailability): string {
  return PUBLIC_AVAILABILITY_LABELS[availability];
}

export function availabilityNote(availability: PublicAvailability): string {
  return availability === 'RESERVED'
    ? VEHICLE_CARD_TEXT.reservedNote
    : availabilityLabel(availability);
}
