import { signOutAction } from '@/features/auth/actions';

export function SignOutButton({
  scope = 'dealer',
  className = 'btn btn-ghost text-[12px]',
}: {
  scope?: 'dealer' | 'admin';
  className?: string;
}) {
  return (
    <form
      action={async () => {
        'use server';
        await signOutAction(scope);
      }}
    >
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
