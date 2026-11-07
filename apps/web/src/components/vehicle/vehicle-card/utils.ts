import {
  NEGOTIABILITY_CARD_LABELS,
  PUBLIC_AVAILABILITY_LABELS,
  type PublicAvailability,
  type VehicleCardDto,
} from '@dealers-drive/contracts';

import { VEHICLE_CARD_TEXT } from './vehicle-card.constants';

export function availabilityLabel(availability: PublicAvailability): string {
  return PUBLIC_AVAILABILITY_LABELS[availability];
}

export function availabilityNote(availability: PublicAvailability): string {
  return availability === 'RESERVED'
    ? VEHICLE_CARD_TEXT.reservedNote
    : availabilityLabel(availability);
}

export function negotiabilityLabel(
  vehicle: Pick<VehicleCardDto, 'priceLabel' | 'negotiability'>,
): string | null {
  return vehicle.priceLabel && vehicle.negotiability
    ? NEGOTIABILITY_CARD_LABELS[vehicle.negotiability]
    : null;
}
