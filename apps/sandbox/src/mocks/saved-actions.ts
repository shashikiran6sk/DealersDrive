export type SavedSlugsState =
  { status: 'customer'; slugs: string[] } | { status: 'anonymous' } | { status: 'unknown' };

export type SetSavedResult =
  | { status: 'ok'; saved: boolean }
  | { status: 'signed-out' }
  | { status: 'refused'; message: string };

export const savedActionStub: {
  account: SavedSlugsState;
  result: SetSavedResult | null;
  delayMs: number;
} = {
  account: { status: 'customer', slugs: ['saved-car'] },
  result: null,
  delayMs: 500,
};

export async function savedSlugsAction(): Promise<SavedSlugsState> {
  return savedActionStub.account;
}

export async function setSavedAction(_slug: string, saved: boolean): Promise<SetSavedResult> {
  await new Promise((resolve) => setTimeout(resolve, savedActionStub.delayMs));
  return savedActionStub.result ?? { status: 'ok', saved };
}
