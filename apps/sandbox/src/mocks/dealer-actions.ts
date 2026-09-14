export interface ProfileFormState {
  status: 'idle' | 'saved' | 'error';
  fieldErrors: Record<string, string>;
  message?: string;
}

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
