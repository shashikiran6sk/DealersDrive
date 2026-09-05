/**
 * A stand-in for `@/features/auth/actions`.
 *
 * Coupling **C-4** in `component-map.md`: `AdminLoginForm` and `SignOutButton`
 * call Server Actions, which need a Next server to exist. The sandbox has no
 * server and must render with the network off, so `.storybook/main.ts` aliases
 * the real module to this one — the pattern `component-sandbox.md` §8
 * prescribes, and the same one `apps/web/tests/setup.ts` already uses.
 *
 * The stubs are deliberately *slow and observable* rather than instant: the
 * submitting state is one of the states the story has to show, and an action
 * that resolved immediately would make it impossible to see.
 */
export interface ActionState {
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  saved?: boolean;
}

/** What the sandbox's action does next. Set by a story before it renders. */
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

export async function adminLoginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return respond('adminLogin', formData);
}

export async function onboardingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return respond('onboarding', formData);
}

/**
 * Steps 1 and 2 again, for a dealership that already exists.
 *
 * `Back` from the Documents step has to lead somewhere, and the create call
 * refuses a second dealership — so the same fields PATCH instead. Which of the
 * two the wizard uses is decided by whether `dealer` is null, so a story that
 * passes one exercises this path.
 */
export async function updateOnboardingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return respond('updateOnboarding', formData);
}

/** The GSTIN/PAN save on the Documents step (**F041**). */
export async function saveBusinessIdsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return respond('saveBusinessIds', formData);
}

/** The submit on the Review step (**F042**). Takes no form data. */
export async function submitForVerificationAction(): Promise<ActionState> {
  authActionStub.calls.push({ action: 'submitForVerification', values: {} });
  await new Promise((resolve) => setTimeout(resolve, authActionStub.delayMs));
  return authActionStub.result;
}

export async function signOutAction(scope: 'dealer' | 'admin' = 'dealer'): Promise<void> {
  authActionStub.calls.push({ action: 'signOut', values: { scope } });
  await new Promise((resolve) => setTimeout(resolve, authActionStub.delayMs));
}
