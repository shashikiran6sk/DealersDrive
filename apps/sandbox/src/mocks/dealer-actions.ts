/**
 * A stand-in for `@/features/dealer/profile-actions`.
 *
 * The same coupling as `auth-actions.ts` and `admin-actions.ts` (**C-4** in
 * `component-map.md`): `DealerProfileForm` calls a Server Action, which needs a
 * Next server, and the sandbox renders with the network off.
 * `.storybook/main.ts` aliases the real module to this one.
 *
 * The stub is deliberately *slow and observable* rather than instant. The
 * pending state of the save button is one of the states the story has to show,
 * and an action that resolved immediately would make it impossible to see.
 */
export interface ProfileFormState {
  status: 'idle' | 'saved' | 'error';
  fieldErrors: Record<string, string>;
  message?: string;
}

/** What the sandbox's action does next. Set by a story before it renders. */
export const dealerProfileStub: {
  delayMs: number;
  result: ProfileFormState;
  calls: Record<string, string>[];
} = {
  delayMs: 900,
  result: { status: 'saved', fieldErrors: {} },
  calls: [],
};

export async function saveDealerProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value;
  }
  dealerProfileStub.calls.push(values);

  await new Promise((resolve) => setTimeout(resolve, dealerProfileStub.delayMs));
  return dealerProfileStub.result;
}

/**
 * R34's Cancel. Resolves to `null` on success, or to a message.
 *
 * `withdrawResult` is separate from `result` above because the two actions fail
 * for different reasons and a story usually wants one of them to work while the
 * other does not.
 */
export const withdrawStub: { delayMs: number; result: string | null; calls: number } = {
  delayMs: 700,
  result: null,
  calls: 0,
};

export async function withdrawProfileChangeAction(): Promise<string | null> {
  withdrawStub.calls += 1;
  await new Promise((resolve) => setTimeout(resolve, withdrawStub.delayMs));
  return withdrawStub.result;
}
