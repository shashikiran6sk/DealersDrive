import { signOutAction } from '@/features/auth/actions';

const SIGN_OUT_LABEL = 'Sign out';

export interface SignOutButtonProps {
  scope?: 'dealer' | 'admin';
  className?: string;
}

export function SignOutButton({
  scope = 'dealer',
  className = 'btn btn-ghost text-[12px]',
}: SignOutButtonProps) {
  return (
    <form
      action={async () => {
        'use server';
        await signOutAction(scope);
      }}
    >
      <button type="submit" className={className}>
        {SIGN_OUT_LABEL}
      </button>
    </form>
  );
}
