export interface ActionState {
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  saved?: boolean;
}

export const authActionStub: {
  delayMs: number;
  result: ActionState;
  calls: { action: string; values: Record<string, string> }[];
} = {
  delayMs: 900,
  result: {},
  calls: [],
};

async function respond(action: string, formData: FormData): Promise<ActionState> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && key !== 'password') values[key] = value;
  }
  authActionStub.calls.push({ action, values });

  await new Promise((resolve) => setTimeout(resolve, authActionStub.delayMs));
  return { ...authActionStub.result, values };
}

export async function onboardingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return respond('onboarding', formData);
}

export async function updateOnboardingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return respond('updateOnboarding', formData);
}

export async function saveBusinessIdsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return respond('saveBusinessIds', formData);
}

export async function submitForVerificationAction(): Promise<ActionState> {
  authActionStub.calls.push({ action: 'submitForVerification', values: {} });
  await new Promise((resolve) => setTimeout(resolve, authActionStub.delayMs));
  return authActionStub.result;
}

export async function signOutAction(scope: 'dealer' | 'admin' = 'dealer'): Promise<void> {
  authActionStub.calls.push({ action: 'signOut', values: { scope } });
  await new Promise((resolve) => setTimeout(resolve, authActionStub.delayMs));
}
