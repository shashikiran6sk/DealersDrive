export type SavedSlugsState =
  { status: 'customer'; slugs: string[] } | { status: 'anonymous' } | { status: 'unknown' };

export type SetSavedResult =
  | { status: 'ok'; saved: boolean }
  | { status: 'signed-out' }
  | { status: 'refused'; message: string };

export type SavedSlugsLoader = () => Promise<SavedSlugsState>;

export type SavedSetter = (slug: string, saved: boolean) => Promise<SetSavedResult>;
