import { cn } from '@/lib/cn';

import { GOOGLE_SIGN_IN_LABEL } from './google-button.constants';
import { GoogleMark } from './google-mark';

export interface GoogleSignInButtonProps {
  href: string;
  label?: string;
  disabled?: boolean;
}

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
    <a className={className} href={href} rel="nofollow">
      {content}
    </a>
  );
}
