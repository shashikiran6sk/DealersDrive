import type { VehicleCardDto } from '@dealers-drive/contracts';

export type StreamDirection = 'up' | 'down';

export interface StockStreamProps {
  cars: readonly VehicleCardDto[];
  className?: string;
}

export interface StreamColumnProps {
  cars: readonly VehicleCardDto[];
  direction: StreamDirection;
}

export interface StreamCardProps {
  car: VehicleCardDto;
}

export interface StreamPauseButtonProps {
  className?: string;
  label?: string;
}
