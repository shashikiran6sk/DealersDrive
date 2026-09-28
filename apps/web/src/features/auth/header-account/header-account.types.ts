import type { CustomerAccount } from '@/features/auth/customer-account-actions';

export interface AccountMenuProps {
  account: CustomerAccount;
  onLogout: () => void;
  loggingOut: boolean;
}
