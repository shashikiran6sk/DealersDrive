import { cn } from '@/lib/cn';

/**
 * "Continue with Google".
 *
 * An `<a>`, not a button: the whole point of the authorization code flow is
 * that the browser *navigates* to Google, and a fetch could not carry the
 * redirect. It is styled as `btn-secondary` with the Google mark on the left —
 * Google's identity guidelines ask for their wordmark and colours on a neutral
 * surface, which is also what the design system's secondary button is.
 *
 * `disabled` renders the same control inert, for a deployment with no Google
 * credentials configured: a button that looks alive and fails on click is worse
 * than one that says why it cannot work.
 */
export function GoogleSignInButton({
  href,
  label = 'Continue with Google',
  disabled = false,
}: {
  href: string;
  label?: string;
  disabled?: boolean;
}) {
  const className = cn(
    'btn btn-secondary btn-block h-11 gap-[10px] text-[15px]',
    disabled && 'pointer-events-none opacity-45',
  );

  const content = (
    <>
      <GoogleMark />
      {label}
    </>
  );

  return disabled ? (
    <span className={className} aria-disabled="true">
      {content}
    </span>
  ) : (
    // A full page navigation, so `next/link`'s client router is not involved.
    <a className={className} href={href} rel="nofollow">
      {content}
    </a>
  );
}

/** The four-colour mark, at the 18px Google specifies for a 44px control. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
