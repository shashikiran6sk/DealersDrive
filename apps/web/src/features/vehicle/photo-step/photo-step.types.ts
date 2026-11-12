import type { BillingSummary, DealerVehiclePhotos, PhotoPlan } from '@dealers-drive/contracts';

export interface PhotoStepProps {
  vehicleId: string;
  photos: DealerVehiclePhotos;
  billing: BillingSummary | null;
  backHref: string;
  nextHref: string;
}

export interface PlanOption {
  plan: PhotoPlan;
  title: string;
  body: string;
  note: string | null;
  available: boolean;
  credits: number | null;
}
