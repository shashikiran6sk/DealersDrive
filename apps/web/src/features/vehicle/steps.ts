/** DESIGN-SPEC §3.14 — the four steps, in order, shared by the stepper and the router. */
export const WIZARD_STEPS = ['Basics', 'Details', 'Photos', 'Price & review'] as const;

export type WizardStep = 0 | 1 | 2 | 3;

/** Clamps `?step=` to a real step; anything unparseable lands on Details. */
export function toStep(raw: string | undefined): WizardStep {
  const parsed = Number(raw);
  if (parsed === 0 || parsed === 1 || parsed === 2 || parsed === 3) return parsed;
  return 1;
}
