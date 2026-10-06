export const AUTH_HINT_COOKIE = 'dd_auth';

export const AUTH_HINT_VALUE = { signedIn: '1', signedOut: '0' } as const;

export type AuthHint = 'in' | 'out' | 'unknown';

export const AUTH_HINT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function authHintFrom(cookieHeader: string): AuthHint {
  const match = new RegExp(`(?:^|;\\s*)${AUTH_HINT_COOKIE}=([01])`).exec(cookieHeader);
  if (!match) return 'unknown';
  return match[1] === AUTH_HINT_VALUE.signedIn ? 'in' : 'out';
}

export const AUTH_HINT_SCRIPT = `(function(){try{var m=/(?:^|;\\s*)${AUTH_HINT_COOKIE}=([01])/.exec(document.cookie);document.documentElement.setAttribute('data-auth',m?(m[1]==='1'?'in':'out'):'unknown')}catch(e){}})();`;
