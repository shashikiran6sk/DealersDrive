import type { DealerVehicle } from '@dealers-drive/contracts';

import { WIZARD_STEPS, STEP_FIELDS, FORM_FIELD_OF } from './vehicle-wizard.constants';
import type { WizardScope, WizardStep } from './vehicle-wizard.types';

export function isWizardStep(value: unknown): value is WizardStep {
  return typeof value === 'string' && WIZARD_STEPS.some((step) => step === value);
}

export function stepAfter(step: WizardStep): WizardStep {
  const index = WIZARD_STEPS.indexOf(step);
  return WIZARD_STEPS[Math.min(index + 1, WIZARD_STEPS.length - 1)] ?? step;
}

export function stepBefore(step: WizardStep): WizardStep {
  const index = WIZARD_STEPS.indexOf(step);
  return WIZARD_STEPS[Math.max(index - 1, 0)] ?? step;
}

export function formField(apiField: string): string {
  const leaf = apiField.replace(/^(body|query|params)\./, '');
  return FORM_FIELD_OF[leaf] ?? leaf;
}

export function stepOfField(apiField: string): WizardStep {
  const field = formField(apiField);
  for (const [step, fields] of Object.entries(STEP_FIELDS)) {
    if (isWizardStep(step) && fields.includes(field)) return step;
  }
  return 'review';
}

export function rupeesToPaise(input: string): number | null {
  const digits = input.replace(/[₹,\s]/g, '');
  if (digits === '') return null;
  if (!/^\d+$/.test(digits)) return Number.NaN;
  return Number(digits) * 100;
}

export function paiseToRupeesText(paise: number | null): string {
  return paise === null ? '' : Math.round(paise / 100).toLocaleString('en-IN');
}

export function editPath(
  vehicleId: string,
  step: WizardStep,
  extra = '',
  scope: WizardScope = { kind: 'dealer' },
): string {
  const base =
    scope.kind === 'sales'
      ? `/sales/dealers/${scope.dealerId}/vehicles/${vehicleId}`
      : `/dealer/vehicles/${vehicleId}`;
  return `${base}/edit?step=${step}${extra}`;
}

export function storedValue(vehicle: DealerVehicle | null, field: string): string {
  if (!vehicle) return '';
  if (field === 'priceRupees') return paiseToRupeesText(vehicle.pricePaise);
  if (field === 'registrationNumber') return vehicle.registrationDisplay;
  const value: unknown = Object.entries(vehicle).find(([key]) => key === field)?.[1];
  if (value === null || value === undefined) return '';
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

export function formValue(
  values: Record<string, string>,
  vehicle: DealerVehicle | null,
  field: string,
): string {
  return values[field] ?? storedValue(vehicle, field);
}
