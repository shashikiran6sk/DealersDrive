import { useLocalSearchParams } from 'expo-router';
import { useSession } from '../../auth/auth-provider';
import { SupportConversation } from '../support-conversation';

export function SupportDetailScreen() {
  const session = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SupportConversation key={`${session.status}:${session.customer?.id}:${id}`} />;
}
