import { cn } from '@/lib/cn';

import { GOOGLE_SIGN_IN_LABEL } from './google-button.constants';
import { GoogleMark } from './google-mark';

export interface GoogleSignInButtonProps {
  href: string;
  label?: string;
  disabled?: boolean;
  variant?: 'secondary' | 'primary';
}

export function GoogleSignInButton({
  href,
  label = GOOGLE_SIGN_IN_LABEL,
  disabled = false,
  variant = 'secondary',
}: GoogleSignInButtonProps) {
  const className = cn(
    'btn btn-block h-12 gap-[12px] text-[15px]',
    variant === 'primary' ? 'btn-primary' : 'btn-secondary',
    disabled && 'pointer-events-none opacity-45',
  );

  const content = (
    <>
      <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-white">
        <GoogleMark />
      </span>
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
