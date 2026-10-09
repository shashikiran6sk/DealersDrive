import type { CustomerAccount } from '@/features/auth/customer-account';
import { SignOutButton } from '@/features/auth/sign-out';

import { WorkspaceSwitcher } from './workspace-switcher';
import { AccountLogout } from './account-logout';

export function ConsoleUtilities({ account }: { account: CustomerAccount | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <WorkspaceSwitcher
        workspaces={account?.workspaces ?? []}
        invitations={account?.invitations ?? 0}
      />
      {account ? (
        <AccountLogout />
      ) : (
        <SignOutButton className="btn btn-secondary min-h-11 w-full text-[13px]" />
      )}
    </div>
  );
}
