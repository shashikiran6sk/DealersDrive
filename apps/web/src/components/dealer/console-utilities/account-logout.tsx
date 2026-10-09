'use client';

import { useRouter } from 'next/navigation';

import { customerLogoutAction } from '@/features/auth/customer-account-actions';
import { HEADER_ACCOUNT_TEXT } from '@/features/auth/header-account/header-account.constants';
import { announceAuthHint } from '@/lib/use-auth-hint';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

const HOME_HREF = '/';

export function AccountLogout() {
  const router = useRouter();
  const [loggingOut, startLogout] = useNavigationSafeAction();

  return (
    <button
      type="button"
      className="btn btn-secondary min-h-11 w-full text-[13px]"
      disabled={loggingOut}
      onClick={() => {
        if (loggingOut) return;
        startLogout(async () => {
          await customerLogoutAction();
          announceAuthHint();
          router.push(HOME_HREF);
        });
      }}
    >
      {loggingOut ? HEADER_ACCOUNT_TEXT.loggingOut : HEADER_ACCOUNT_TEXT.logout}
    </button>
  );
}
