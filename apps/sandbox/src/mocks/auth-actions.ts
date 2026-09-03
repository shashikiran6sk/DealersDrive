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

export async function signOutAction(scope: 'dealer' | 'admin' = 'dealer'): Promise<void> {
  authActionStub.calls.push({ action: 'signOut', values: { scope } });
  await new Promise((resolve) => setTimeout(resolve, authActionStub.delayMs));
}
