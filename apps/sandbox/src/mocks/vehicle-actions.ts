export interface WizardState {
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

export const vehicleWizardStub: {
  delayMs: number;
  result: WizardState;
  calls: Record<string, string>[];
} = {
  delayMs: 700,
  result: {},
  calls: [],
};

async function record(formData: FormData): Promise<WizardState> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value;
  }
  vehicleWizardStub.calls.push(values);
  await new Promise((resolve) => setTimeout(resolve, vehicleWizardStub.delayMs));
  return { ...vehicleWizardStub.result, values };
}

export async function createVehicleAction(
  _previous: WizardState,
  formData: FormData,
): Promise<WizardState> {
  return record(formData);
}

export async function saveVehicleStepAction(
  _previous: WizardState,
  formData: FormData,
): Promise<WizardState> {
  return record(formData);
}
