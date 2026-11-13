import type { DealerVehiclePhotos, PhotoPlan } from '@dealers-drive/contracts';

export interface PhotoStepProps {
  vehicleId: string;
  photos: DealerVehiclePhotos;
  backHref: string;
  nextHref: string;
}

export interface PlanOption {
  plan: PhotoPlan;
  title: string;
  body: string;
  note: string | null;
  available: boolean;
}
