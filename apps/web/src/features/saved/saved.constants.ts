export const SAVE_PARAM = 'save';

export const SAVED_PATH = '/saved';

export const SAVED_ACTION_TEXT = {
  failed: 'That car could not be saved. Try again.',
  unavailable: 'Saved cars are unavailable right now. Try again shortly.',
  invalid: 'That car could not be found.',
} as const;

export function saveIntentPath(pathname: string, search: string, slug: string): string {
  const params = new URLSearchParams(search);
  params.set(SAVE_PARAM, slug);
  return `${pathname}?${params.toString()}`;
}

export function saveLoginHref(pathname: string, search: string, slug: string): string {
  return `/login?returnTo=${encodeURIComponent(saveIntentPath(pathname, search, slug))}`;
}

export function withoutSaveParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(SAVE_PARAM);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
