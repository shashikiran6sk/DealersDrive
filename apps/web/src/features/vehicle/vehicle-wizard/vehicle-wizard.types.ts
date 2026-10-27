import type { DealerVehicle, UpdateVehicleInput } from '@dealers-drive/contracts';

export type WizardStep = 'registration' | 'basics' | 'details' | 'pricing' | 'review';

export type WizardIntent = 'continue' | 'back' | 'draft';

export type WizardScope = { kind: 'dealer' } | { kind: 'sales'; dealerId: string };

export interface WizardState {
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

export type VehicleFormValues = Pick<
  DealerVehicle,
  keyof UpdateVehicleInput | 'registrationDisplay'
>;

export interface StepProps {
  vehicle: VehicleFormValues | null;
  errors: Record<string, string>;
  values: Record<string, string>;
}
