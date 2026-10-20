import { useLocalSearchParams } from 'expo-router';
import { useSession } from '../../auth/auth-provider';
import { SupportCreateForm } from '../support-create-form';

export function SupportCreateScreen() {
  const session = useSession();
  const params = useLocalSearchParams<{
    category?: string;
    subject?: string;
    enquiryId?: string;
  }>();
  return (
    <SupportCreateForm
      key={`${session.status}:${session.customer?.id}:${params.category}:${params.subject}:${params.enquiryId}`}
    />
  );
}
