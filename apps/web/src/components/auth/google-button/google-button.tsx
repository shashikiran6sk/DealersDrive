import { cn } from '@/lib/cn';

import { GOOGLE_SIGN_IN_LABEL } from './google-button.constants';
import { GoogleMark } from './google-mark';

export interface GoogleSignInButtonProps {
  href: string;
  label?: string;
  disabled?: boolean;
}

/**
 * "Continue with Google". An `<a>`, not a button: the authorization code flow
 * needs the browser to *navigate* to Google, and a fetch could not carry the
 * redirect. `disabled` renders the same control inert for a deployment with no
 * Google credentials — a button that looks alive and fails on click is worse
 * than one that says why it cannot work.
 */
export function GoogleSignInButton({
  href,
  label = GOOGLE_SIGN_IN_LABEL,
  disabled = false,
}: GoogleSignInButtonProps) {
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
