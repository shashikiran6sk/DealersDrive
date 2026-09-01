import { VEHICLE_WIZARD_STEPS } from '@dealers-drive/contracts';

/**
 * DESIGN-SPEC §3.14 — the four steps, in order, shared by the stepper and the
 * router.
 *
 * The labels come from `packages/contracts`, which is also where the API reads
 * each step's required fields from. One array, so the step the wizard calls
 * "Details" and the step the server refuses to let past are the same step.
 */
export const WIZARD_STEPS = VEHICLE_WIZARD_STEPS.map((step) => step.label);

export type WizardStep = 0 | 1 | 2 | 3;

/** Clamps `?step=` to a real step; anything unparseable lands on Details. */
export function toStep(raw: string | undefined): WizardStep {
  const parsed = Number(raw);
  if (parsed === 0 || parsed === 1 || parsed === 2 || parsed === 3) return parsed;
  return 1;
}
