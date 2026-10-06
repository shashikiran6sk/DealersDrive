import type { CustomerAccount } from '@/features/auth/customer-account-actions';

import type { AccountLoader } from './account-client';

export interface AccountMenuProps {
  account: CustomerAccount;
  onLogout: () => void;
  loggingOut: boolean;
  onEnterWorkspace?: (membershipId: string) => void;
  enteringWorkspace?: string | null;
}

export interface HeaderAccountProps {
  initialAccount?: CustomerAccount | null;
  afterLogoutHref?: string;
  loadAccount?: AccountLoader;
}
