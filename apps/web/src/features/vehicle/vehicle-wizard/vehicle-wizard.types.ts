import type { DealerVehicle } from '@dealers-drive/contracts';

export type WizardStep = 'registration' | 'basics' | 'details' | 'pricing' | 'review';

export type WizardIntent = 'continue' | 'back' | 'draft';

export type WizardScope = { kind: 'dealer' } | { kind: 'sales'; dealerId: string };

export interface WizardState {
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

export interface StepProps {
  vehicle: DealerVehicle | null;
  errors: Record<string, string>;
  values: Record<string, string>;
}
