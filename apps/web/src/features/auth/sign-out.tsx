import { signOutAction } from '@/features/auth/actions';

/**
 * Sign out — a form, not a link.
 *
 * A GET that ends a session can be triggered by any image tag on any page, so
 * this posts. The Server Action revokes the row at the API before clearing the
 * cookie, which is the difference between signing out and merely forgetting.
 */
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
