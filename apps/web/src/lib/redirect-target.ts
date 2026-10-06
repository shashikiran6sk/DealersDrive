export interface RedirectTarget {
  href: string;
  replace: boolean;
}

const REDIRECT_DIGEST = 'NEXT_REDIRECT';

export function redirectTargetOf(error: unknown): RedirectTarget | null {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return null;
  const { digest } = error;
  if (typeof digest !== 'string' || !digest.startsWith(`${REDIRECT_DIGEST};`)) return null;
  const [, type, ...rest] = digest.split(';');
  const href = rest.slice(0, -2).join(';');
  if (!href) return null;
  return { href, replace: type === 'replace' };
}
