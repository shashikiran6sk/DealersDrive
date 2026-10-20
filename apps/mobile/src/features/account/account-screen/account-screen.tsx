import { useAuth, useSession } from '../../auth/auth-provider';
import { AccountControls } from '../account-controls';

export function AccountScreen() {
  const { manager } = useAuth();
  const session = useSession();
  return (
    <AccountControls key={`${session.status}:${session.customer?.id}:${manager.expiresAt()}`} />
  );
}
