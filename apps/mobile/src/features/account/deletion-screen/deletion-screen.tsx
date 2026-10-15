import { useSession } from '../../auth/auth-provider';
import { DeletionRequest } from '../deletion-request';

export function DeletionScreen() {
  const session = useSession();
  return <DeletionRequest key={`${session.status}:${session.customer?.id}`} />;
}
